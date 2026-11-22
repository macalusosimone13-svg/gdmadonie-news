-- 05 — "Chiedi all'ARS": le leggi piu' recenti entrano sempre tra le fonti
-- quando la domanda chiede le ultime leggi (parametro "recenti").
-- Prima la ricerca era solo testuale: una legge senza le parole della
-- domanda nel testo (es. la manovrina 1200/A, inserita a mano) restava fuori.
drop function if exists public.ars_cerca_fonti(text[], text[], text[], integer, boolean);

create or replace function public.ars_cerca_fonti(musts text[], anys text[], comuni text[] default '{}', limite integer default 30, futuro boolean default false, recenti boolean default false)
 returns table(fonte text, id text, titolo text, data date, estratto text, url text, luoghi text[], risposta boolean, punteggio real)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare q tsquery := public.ars_tsq(musts, anys); oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if q is null and not recenti then return; end if;
  q := coalesce(q, to_tsquery('simple', 'zzzznessunaparola'));
  return query
  with atti as (
    select 'atto'::text f, a.k xid, a.titolo t, a.data d, a.luoghi l, a.ha_risposta r,
      ts_rank_cd(a.fts, q, 1)
        * (case when coalesce(cardinality(comuni),0) > 0 and a.luoghi && comuni then 2.2 else 1 end)
        * (1 + greatest(0, 1 - (oggi - coalesce(a.data, oggi - 2000)) / 1200.0) * 0.6)
        * (case when a.ha_risposta then 1.15 else 1 end) s,
      a.testo tx, a.risposta->>'txt' rt, a.orale->>'txt' ot, a.sintesi->>'breve' sb
    from ars_atti a where a.fts @@ q
    order by 7 desc limit greatest(limite, 10)
  ), leggi as (
    select 'legge'::text f, l.id xid, coalesce(l.titolo_breve || ' — ', '') || coalesce(l.titolo, 'Disegno di legge n. ' || l.ddl) t, l.data d,
      '{}'::text[] lu, true r,
      (case
        when recenti and l.data >= oggi - 365
          then greatest(case when l.fts @@ q then ts_rank_cd(l.fts, q, 1) * 2.0 else 0 end, 4)
               + 4 * greatest(0, 1 - (oggi - l.data) / 365.0)
        else ts_rank_cd(l.fts, q, 1) * 2.0
      end) s
    from ars_leggi l
    where l.unita_a is null and (l.fts @@ q or (recenti and l.data >= oggi - 365))
    order by 7 desc limit 8
  ), misure as (
    select 'misura'::text f, m.id xid, m.titolo || ' (art. ' || m.articolo || ')' t, l.data d, '{}'::text[] lu, false r,
      ts_rank_cd(m.fts, q, 1) * 1.6 s, coalesce(m.sintesi,'') || ' ' || coalesce(m.req_testo,'') x, m.legge_id lid
    from ars_misure m join ars_leggi l on l.id = m.legge_id where m.fts @@ q order by 7 desc limit 8
  ), conv as (
    select 'commissione'::text f, c.id xid, c.commissione || ': ' || left(c.odg, 160) t, c.data d, '{}'::text[] lu, false r,
      ts_rank_cd(c.fts, q, 1) * (case when futuro and c.data >= oggi then 3 else 1 end)
        * (1 + greatest(0, 1 - (oggi - c.data) / 365.0)) s, c.odg x
    from ars_convocazioni c where c.fts @@ q and not c.disdetta and not c.tolta order by 7 desc limit 8
  ), post as (
    select (case when p.category in ('comunicato','news_gd','proposta','approfondimento') then 'gd' else 'stampa' end)::text f,
      coalesce(p.slug, p.id::text) xid, p.title t, coalesce(p.published_date, p.created_at)::date d, '{}'::text[] lu, false r,
      ts_rank_cd(to_tsvector('public.ars_it'::regconfig, coalesce(p.title,'') || ' ' || coalesce(p.excerpt,'')), q, 1)
        * (case when p.category in ('comunicato','news_gd','proposta','approfondimento') then 1.4 else 0.9 end)
        * (1 + greatest(0, 1 - (oggi - coalesce(p.published_date, p.created_at)::date) / 365.0)) s,
      p.excerpt x, p.source_name sn
    from posts p
    where p.status = 'published' and to_tsvector('public.ars_it'::regconfig, coalesce(p.title,'') || ' ' || coalesce(p.excerpt,'')) @@ q
    order by 7 desc limit 8
  ), paesi as (
    select 'paese'::text f, n.comune_slug || '/' || n.id::text xid, n.titolo t, n.published_date::date d, '{}'::text[] lu, false r,
      ts_rank_cd(to_tsvector('public.ars_it'::regconfig, coalesce(n.titolo,'') || ' ' || coalesce(n.riassunto,'')), q, 1)
        * (1 + greatest(0, 1 - (oggi - n.published_date::date) / 365.0)) s, n.riassunto x
    from comuni_notizie n
    where n.stato = 'pubblicata' and to_tsvector('public.ars_it'::regconfig, coalesce(n.titolo,'') || ' ' || coalesce(n.riassunto,'')) @@ q
    order by 7 desc limit 8
  ), tutto as (
    select a.f, a.xid, a.t, a.d,
      left(coalesce(nullif(a.sb, ''), ts_headline('public.ars_it', coalesce(a.tx, '') || ' ' || coalesce(a.rt, '') || ' ' || coalesce(a.ot, ''), q,
        'MaxWords=55, MinWords=25, MaxFragments=2, FragmentDelimiter=" … ", StartSel="", StopSel=""')), 600) x,
      null::text u, a.l, a.r, a.s::real s
    from atti a
    union all select f, xid, t, d, null, '/ars/legge/' || lower(xid), lu, r, s::real from leggi
    union all select f, xid, t, d, left(x, 400), '/ars/legge/' || lower(lid), lu, r, s::real from misure
    union all select f, xid, t, d, left(x, 500), '/ars/aula', lu, r, s::real from conv
    union all select f, xid, t, d, left(coalesce(x, '') || case when sn is not null and f = 'stampa' then ' (' || sn || ')' else '' end, 400), null, lu, r, s::real from post
    union all select f, xid, t, d, left(x, 400), null, lu, r, s::real from paesi
  )
  select * from tutto order by 9 desc limit limite;
end $function$;
