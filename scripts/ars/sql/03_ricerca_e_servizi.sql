-- Sezione ARS: ricerca su tutto il sito, panoramica, segnalazioni, cache dell'IA.

alter table public.ars_deputati add column if not exists recenti jsonb not null default '[]';
alter table public.ars_deputati add column if not exists gruppo_breve text;

create table if not exists public.ars_cerca_cache (
  chiave text primary key, domanda text, risposta jsonb not null, at timestamptz not null default now()
);
alter table public.ars_cerca_cache enable row level security;

-- indici per cercare anche nelle notizie del sito (News GD, rassegna, paesi)
create index if not exists posts_ars_fts on public.posts using gin (to_tsvector('public.ars_it'::regconfig, coalesce(title,'') || ' ' || coalesce(excerpt,'')));
create index if not exists comuni_notizie_ars_fts on public.comuni_notizie using gin (to_tsvector('public.ars_it'::regconfig, coalesce(titolo,'') || ' ' || coalesce(riassunto,'')));

-- ---------------------------------------------------------------- tsquery
-- Le parole chiave arrivano dall'IA (o dalla domanda): ogni voce puo' essere
-- una parola o un'espressione ("piano battaglia"). "musts": tutte presenti;
-- "anys": almeno una.
create or replace function public.ars_tsq(musts text[], anys text[])
returns tsquery language plpgsql immutable as $$
declare q_m tsquery; q_a tsquery; x tsquery; w text;
begin
  foreach w in array coalesce(musts, '{}') loop
    x := phraseto_tsquery('public.ars_it', w);
    if numnode(x) > 0 then q_m := case when q_m is null then x else q_m && x end; end if;
  end loop;
  foreach w in array coalesce(anys, '{}') loop
    x := phraseto_tsquery('public.ars_it', w);
    if numnode(x) > 0 then q_a := case when q_a is null then x else q_a || x end; end if;
  end loop;
  if q_m is null then return q_a; end if;
  if q_a is null then return q_m; end if;
  return q_m && q_a;
end $$;

-- ---------------------------------------------------------------- ricerca
-- Restituisce le fonti piu' pertinenti da tutto il sito: atti ARS (con le
-- risposte del Governo), leggi, misure della manovra, commissioni, News GD,
-- rassegna stampa, notizie dei paesi.
create or replace function public.ars_cerca_fonti(musts text[], anys text[], comuni text[] default '{}', limite int default 30, futuro boolean default false)
returns table (fonte text, id text, titolo text, data date, estratto text, url text, luoghi text[], risposta boolean, punteggio real)
language plpgsql stable set search_path = public as $$
declare q tsquery := public.ars_tsq(musts, anys); oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if q is null then return; end if;
  return query
  with atti as (
    select 'atto'::text f, a.k id, a.titolo t, a.data d, a.luoghi l, a.ha_risposta r,
      ts_rank_cd(a.fts, q, 1)
        * (case when coalesce(cardinality(comuni),0) > 0 and a.luoghi && comuni then 2.2 else 1 end)
        * (1 + greatest(0, 1 - (oggi - coalesce(a.data, oggi - 2000)) / 1200.0) * 0.6)
        * (case when a.ha_risposta then 1.15 else 1 end) s,
      a.testo, a.risposta->>'txt' rt, a.orale->>'txt' ot, a.sintesi->>'breve' sb
    from ars_atti a where a.fts @@ q
    order by 7 desc limit greatest(limite, 10)
  ), leggi as (
    select 'legge'::text f, l.id, coalesce(l.titolo_breve || ' — ', '') || coalesce(l.titolo, 'Disegno di legge n. ' || l.ddl) t, l.data d,
      '{}'::text[] lu, true r, ts_rank_cd(l.fts, q, 1) * 2.0 s
    from ars_leggi l where l.fts @@ q order by 7 desc limit 8
  ), misure as (
    select 'misura'::text f, m.id, m.titolo || ' (art. ' || m.articolo || ')' t, l.data d, '{}'::text[] lu, false r,
      ts_rank_cd(m.fts, q, 1) * 1.6 s, coalesce(m.sintesi,'') || ' ' || coalesce(m.req_testo,'') x, m.legge_id
    from ars_misure m join ars_leggi l on l.id = m.legge_id where m.fts @@ q order by 7 desc limit 8
  ), conv as (
    select 'commissione'::text f, c.id, c.commissione || ': ' || left(c.odg, 160) t, c.data d, '{}'::text[] lu, false r,
      ts_rank_cd(c.fts, q, 1) * (case when futuro and c.data >= oggi then 3 else 1 end)
        * (1 + greatest(0, 1 - (oggi - c.data) / 365.0)) s, c.odg x
    from ars_convocazioni c where c.fts @@ q and not c.disdetta order by 7 desc limit 8
  ), post as (
    select (case when p.category in ('comunicato','news_gd','proposta','approfondimento') then 'gd' else 'stampa' end)::text f,
      coalesce(p.slug, p.id::text) id, p.title t, coalesce(p.published_date, p.created_at)::date d, '{}'::text[] lu, false r,
      ts_rank_cd(to_tsvector('public.ars_it'::regconfig, coalesce(p.title,'') || ' ' || coalesce(p.excerpt,'')), q, 1)
        * (case when p.category in ('comunicato','news_gd','proposta','approfondimento') then 1.4 else 0.9 end)
        * (1 + greatest(0, 1 - (oggi - coalesce(p.published_date, p.created_at)::date) / 365.0)) s,
      p.excerpt x, p.source_name sn
    from posts p
    where p.status = 'published' and to_tsvector('public.ars_it'::regconfig, coalesce(p.title,'') || ' ' || coalesce(p.excerpt,'')) @@ q
    order by 7 desc limit 8
  ), paesi as (
    select 'paese'::text f, n.comune_slug || '/' || n.id::text id, n.titolo t, n.published_date::date d, '{}'::text[] lu, false r,
      ts_rank_cd(to_tsvector('public.ars_it'::regconfig, coalesce(n.titolo,'') || ' ' || coalesce(n.riassunto,'')), q, 1)
        * (1 + greatest(0, 1 - (oggi - n.published_date::date) / 365.0)) s, n.riassunto x
    from comuni_notizie n
    where n.stato = 'pubblicata' and to_tsvector('public.ars_it'::regconfig, coalesce(n.titolo,'') || ' ' || coalesce(n.riassunto,'')) @@ q
    order by 7 desc limit 8
  ), tutto as (
    select a.f, a.id, a.t, a.d,
      left(coalesce(nullif(a.sb, ''), ts_headline('public.ars_it', coalesce(a.testo, '') || ' ' || coalesce(a.rt, '') || ' ' || coalesce(a.ot, ''), q,
        'MaxWords=55, MinWords=25, MaxFragments=2, FragmentDelimiter=" … ", StartSel="", StopSel=""')), 600) x,
      null::text u, a.l, a.r, a.s::real s
    from atti a
    union all select f, id, t, d, null, '/ars/legge/' || lower(id), lu, r, s::real from leggi
    union all select f, id, t, d, left(x, 400), '/ars/legge/' || lower(legge_id), lu, r, s::real from misure
    union all select f, id, t, d, left(x, 500), '/ars/aula', lu, r, s::real from conv
    union all select f, id, t, d, left(coalesce(x, '') || case when sn is not null and f = 'stampa' then ' (' || sn || ')' else '' end, 400), null, lu, r, s::real from post
    union all select f, id, t, d, left(x, 400), null, lu, r, s::real from paesi
  )
  select * from tutto order by s desc limit limite;
end $$;

-- ---------------------------------------------------------------- panoramica
create or replace function public.ars_panoramica()
returns jsonb language sql stable set search_path = public as $$
  with oggi as (select (now() at time zone 'Europe/Rome')::date d),
  mad as (select array['Madonie','Alimena','Aliminusa','Blufi','Bompietro','Caccamo','Caltavuturo','Castelbuono','Castellana Sicula','Cefalù','Collesano','Gangi','Geraci Siculo','Gratteri','Isnello','Montemaggiore Belsito','Petralia Soprana','Petralia Sottana','Polizzi Generosa','Pollina','San Mauro Castelverde','Scillato','Sclafani Bagni'] m)
  select jsonb_build_object(
    'conteggi', jsonb_build_object(
      'atti', (select count(*) from ars_atti),
      'interrogazioni', (select count(*) from ars_atti where tipo = 'I'),
      'interpellanze', (select count(*) from ars_atti where tipo = 'P'),
      'mozioni', (select count(*) from ars_atti where tipo = 'M'),
      'ddl', (select count(*) from ars_atti where tipo = 'D'),
      'risposte', (select count(*) from ars_atti where ha_risposta),
      'madonie', (select count(*) from ars_atti, mad where luoghi && mad.m),
      'leggi', (select count(*) from ars_leggi where approvata),
      'sedute', (select count(*) from ars_sedute where data <= (select d from oggi)),
      'convocazioni', (select count(*) from ars_convocazioni)),
    'ultimo_controllo', (select valore from ars_meta where chiave = 'ultimo_controllo'),
    'legge_in_evidenza', (select to_jsonb(l) - 'fts' from ars_leggi l where approvata order by data desc nulls last, updated_at desc limit 1),
    'ultime_leggi', (select coalesce(jsonb_agg(x), '[]') from (select id, ddl, titolo, titolo_breve, data, favorevoli, contrari, astenuti, approvata from ars_leggi where approvata order by data desc nulls last limit 4) x),
    'ultime_risposte', (select coalesce(jsonb_agg(x), '[]') from (
        select k, tipo, n, titolo, data, firmatari, gruppo, luoghi,
          greatest(coalesce((risposta->>'d')::date, '1900-01-01'), case when orale->>'stato' in ('svolta','parzialmente svolta') then coalesce((orale->>'data')::date, '1900-01-01') else '1900-01-01' end) rd
        from ars_atti where ha_risposta order by rd desc, n desc limit 6) x),
    'madonie_recenti', (select coalesce(jsonb_agg(x), '[]') from (
        select k, tipo, n, titolo, data, firmatari, gruppo, luoghi, ha_risposta from ars_atti, mad where luoghi && mad.m order by data desc nulls last, n desc limit 8) x),
    'ultimi_atti', (select coalesce(jsonb_agg(x), '[]') from (
        select k, tipo, n, titolo, data, firmatari, gruppo, luoghi, ha_risposta from ars_atti where tipo <> 'D' order by data desc nulls last, n desc limit 6) x),
    'prossime_sedute', (select coalesce(jsonb_agg(x order by x.data), '[]') from (
        select n, data, giorni, odg, odg_url from ars_sedute where data >= (select d from oggi) order by data limit 4) x),
    'ultime_sedute', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select n, data, giorni, odg, odg_url, res_url from ars_sedute where data < (select d from oggi) order by n desc limit 3) x),
    'prossime_commissioni', (select coalesce(jsonb_agg(x order by x.data), '[]') from (
        select id, data, foglio, commissione, odg, disdetta from ars_convocazioni where data >= (select d from oggi) order by data, foglio limit 12) x)
  );
$$;

-- ---------------------------------------------------------------- dall'ARS per un paese
create or replace function public.ars_per_paese(nome text, limite int default 6)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'totale', (select count(*) from ars_atti where luoghi @> array[nome]),
    'atti', (select coalesce(jsonb_agg(x), '[]') from (
      select k, tipo, n, titolo, data, firmatari, gruppo, ha_risposta from ars_atti where luoghi @> array[nome]
      order by data desc nulls last, n desc limit limite) x));
$$;

-- ---------------------------------------------------------------- "Segnala un errore"
-- Finisce nella stessa casella delle richieste di Partecipa (pannello Admin).
create or replace function public.ars_segnala(p_pagina text, p_testo text, p_contatto text default null, p_trappola text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare hdr json; ip text; iph text; n_ip int; n_all int;
begin
  if coalesce(btrim(p_trappola), '') <> '' then return json_build_object('ok', true); end if;
  if length(btrim(coalesce(p_testo, ''))) < 5 then return json_build_object('ok', false, 'error', 'Scrivi in poche parole cosa non torna.'); end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ip := coalesce(hdr->>'cf-connecting-ip', split_part(coalesce(hdr->>'x-forwarded-for',''), ',', 1), '');
  iph := case when ip <> '' then encode(extensions.digest(ip || 'gdmadonie', 'sha256'), 'hex') else null end;
  select count(*) into n_ip from public.partecipa_richieste where ip_hash = iph and created_at > now() - interval '1 hour';
  select count(*) into n_all from public.partecipa_richieste where created_at > now() - interval '1 hour';
  if (iph is not null and n_ip >= 5) or n_all >= 60 then
    return json_build_object('ok', false, 'error', 'Hai già inviato diverse segnalazioni: riprova tra un po''.');
  end if;
  insert into public.partecipa_richieste (tipo, nome, comune, contatto, messaggio, user_id, ip_hash)
  values ('segnalazione', 'Segnalazione sezione ARS', null,
          coalesce(nullif(left(btrim(coalesce(p_contatto, '')), 120), ''), '(non indicato)'),
          left('[Errore nella sezione ARS] ' || coalesce(left(p_pagina, 200), '') || E'\n\n' || btrim(p_testo), 2000), auth.uid(), iph);
  return json_build_object('ok', true);
end $$;
