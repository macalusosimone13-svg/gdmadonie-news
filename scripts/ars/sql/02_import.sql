-- Import dell'archivio ARS: chiamata solo dalla funzione ars-import (service role).
-- Aggiorna le righe solo se qualcosa e' cambiato; i campi corretti a mano
-- (elencati in ars_atti.bloccati) non vengono mai sovrascritti.
create or replace function public.ars_import(tabella text, righe jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  nuovi text[] := '{}'; risposte text[] := '{}'; leggi_nuove text[] := '{}'; tot int := 0; u record;
begin
  if tabella = 'atti' then
    select coalesce(array_agg(r->>'k'), '{}') into nuovi from jsonb_array_elements(righe) r
      where not exists (select 1 from ars_atti a where a.k = r->>'k');
    select coalesce(array_agg(a.k), '{}') into risposte from jsonb_array_elements(righe) r join ars_atti a on a.k = r->>'k'
      where (jsonb_typeof(r->'risposta') = 'object' and a.risposta is null)
         or (jsonb_typeof(r->'orale') = 'object' and r->'orale'->>'stato' in ('svolta','parzialmente svolta')
             and (a.orale is null or coalesce(a.orale->>'stato','') not in ('svolta','parzialmente svolta')) and a.risposta is null);
    with x as (
      select * from jsonb_to_recordset(righe) as x(k text, tipo text, n int, titolo text, data date, data_presentazione date,
        firmatari text[], iniziativa text, gruppo text, destinatari text[], commissione text, seduta int, luoghi text[],
        pagina int, fonte text, url_doc text, iter jsonb, testo text, risposta jsonb, orale jsonb, ha_risposta boolean)
    )
    insert into ars_atti as a (k, tipo, n, titolo, data, data_presentazione, firmatari, iniziativa, gruppo, destinatari, commissione,
      seduta, luoghi, pagina, fonte, url_doc, iter, testo, risposta, orale, ha_risposta)
    select k, tipo, n, titolo, data, data_presentazione, coalesce(firmatari,'{}'), iniziativa, gruppo, coalesce(destinatari,'{}'), commissione,
      seduta, coalesce(luoghi,'{}'), pagina, fonte, url_doc, iter, testo, risposta, orale, coalesce(ha_risposta,false) from x
    on conflict (k) do update set
      tipo = excluded.tipo, n = excluded.n,
      titolo = case when 'titolo' = any(a.bloccati) then a.titolo else excluded.titolo end,
      data = excluded.data,
      data_presentazione = coalesce(excluded.data_presentazione, a.data_presentazione),
      firmatari = case when 'firmatari' = any(a.bloccati) then a.firmatari else excluded.firmatari end,
      iniziativa = excluded.iniziativa,
      gruppo = case when 'firmatari' = any(a.bloccati) then a.gruppo else excluded.gruppo end,
      destinatari = excluded.destinatari,
      commissione = excluded.commissione,
      seduta = excluded.seduta,
      luoghi = case when 'luoghi' = any(a.bloccati) then a.luoghi else excluded.luoghi end,
      pagina = excluded.pagina, fonte = excluded.fonte, url_doc = excluded.url_doc, iter = excluded.iter,
      testo = coalesce(excluded.testo, a.testo),
      risposta = coalesce(excluded.risposta, a.risposta),
      orale = case when excluded.orale is null then a.orale
                   when a.orale is null then excluded.orale
                   when coalesce(excluded.orale->>'stato','') in ('svolta','parzialmente svolta') or coalesce(a.orale->>'stato','') not in ('svolta','parzialmente svolta') then excluded.orale
                   else a.orale end,
      ha_risposta = excluded.ha_risposta or (a.risposta is not null) or coalesce(a.orale->>'stato','') in ('svolta','parzialmente svolta'),
      updated_at = now()
    where (a.titolo, a.data, a.data_presentazione, a.firmatari, a.iniziativa, a.gruppo, a.destinatari, a.commissione, a.seduta, a.luoghi,
           a.pagina, a.fonte, a.url_doc, a.iter, a.testo, a.risposta, a.orale, a.ha_risposta)
      is distinct from
          (excluded.titolo, excluded.data, coalesce(excluded.data_presentazione, a.data_presentazione), excluded.firmatari, excluded.iniziativa, excluded.gruppo,
           excluded.destinatari, excluded.commissione, excluded.seduta, excluded.luoghi, excluded.pagina, excluded.fonte, excluded.url_doc, excluded.iter,
           coalesce(excluded.testo, a.testo), coalesce(excluded.risposta, a.risposta),
           case when excluded.orale is null then a.orale when a.orale is null then excluded.orale
                when coalesce(excluded.orale->>'stato','') in ('svolta','parzialmente svolta') or coalesce(a.orale->>'stato','') not in ('svolta','parzialmente svolta') then excluded.orale else a.orale end,
           excluded.ha_risposta or (a.risposta is not null) or coalesce(a.orale->>'stato','') in ('svolta','parzialmente svolta'));
    get diagnostics tot = row_count;

  elsif tabella = 'leggi' then
    select coalesce(array_agg(r->>'id'), '{}') into leggi_nuove from jsonb_array_elements(righe) r
      where (r->>'approvata')::boolean and not exists (select 1 from ars_leggi l where l.id = r->>'id');
    with x as (
      select * from jsonb_to_recordset(righe) as x(id text, ddl text, num text, titolo text, data date, seduta int, approvata boolean,
        favorevoli int, contrari int, astenuti int, presenti int, pagina int, commissione text, percorso jsonb, testo text)
    )
    insert into ars_leggi as l (id, ddl, num, titolo, data, seduta, approvata, favorevoli, contrari, astenuti, presenti, pagina, commissione, percorso, testo, extra)
    select id, ddl, num, titolo, data, seduta, approvata, favorevoli, contrari, astenuti, presenti, pagina, commissione, percorso, testo,
      case when testo is not null then jsonb_build_object('testo_ricerca', left(testo, 20000)) end from x
    on conflict (id) do update set
      ddl = case when l.manuale then l.ddl else excluded.ddl end,
      num = coalesce(l.num, excluded.num),
      titolo = case when l.manuale and l.titolo is not null then l.titolo else coalesce(nullif(excluded.titolo,''), l.titolo) end,
      data = case when l.manuale then coalesce(l.data, excluded.data) else excluded.data end,
      seduta = coalesce(excluded.seduta, l.seduta),
      approvata = case when l.manuale then l.approvata else excluded.approvata end,
      favorevoli = case when l.manuale then coalesce(l.favorevoli, excluded.favorevoli) else excluded.favorevoli end,
      contrari = case when l.manuale then coalesce(l.contrari, excluded.contrari) else excluded.contrari end,
      astenuti = case when l.manuale then coalesce(l.astenuti, excluded.astenuti) else excluded.astenuti end,
      presenti = coalesce(excluded.presenti, l.presenti),
      pagina = coalesce(excluded.pagina, l.pagina),
      commissione = coalesce(nullif(excluded.commissione,''), l.commissione),
      percorso = coalesce(excluded.percorso, l.percorso),
      testo = coalesce(excluded.testo, l.testo),
      extra = case when excluded.testo is not null then coalesce(l.extra, '{}'::jsonb) || jsonb_build_object('testo_ricerca', left(excluded.testo, 20000)) else l.extra end,
      updated_at = now()
    where (l.ddl, l.titolo, l.data, l.seduta, l.approvata, l.favorevoli, l.contrari, l.astenuti, l.presenti, l.pagina, l.commissione, l.percorso, l.testo)
      is distinct from (excluded.ddl, excluded.titolo, excluded.data, excluded.seduta, excluded.approvata, excluded.favorevoli, excluded.contrari,
                        excluded.astenuti, excluded.presenti, excluded.pagina, excluded.commissione, coalesce(excluded.percorso, l.percorso), coalesce(excluded.testo, l.testo));
    get diagnostics tot = row_count;
    -- una legge inserita a mano (prima che uscisse il resoconto) viene unita a quella letta dal resoconto
    for u in
      select m.id vecchia, n.id nuova, m.titolo_breve, m.extra, m.gurs, m.titolo mtit from ars_leggi m join ars_leggi n
        on m.manuale and m.unita_a is null and not n.manuale and n.approvata and n.id in (select r->>'id' from jsonb_array_elements(righe) r)
       and split_part(btrim(regexp_replace(m.ddl, '[^0-9]+', ' ', 'g')), ' ', 1) = split_part(btrim(regexp_replace(n.ddl, '[^0-9]+', ' ', 'g')), ' ', 1)
       and abs(coalesce(n.data, m.data) - coalesce(m.data, n.data)) <= 5
    loop
      update ars_misure set legge_id = u.nuova where legge_id = u.vecchia;
      update ars_leggi set titolo_breve = coalesce(titolo_breve, u.titolo_breve), extra = coalesce(u.extra, '{}'::jsonb) || coalesce(extra, '{}'::jsonb),
        gurs = coalesce(gurs, u.gurs), titolo = coalesce(titolo, u.mtit), updated_at = now() where id = u.nuova;
      update ars_leggi set unita_a = u.nuova, updated_at = now() where id = u.vecchia;
      leggi_nuove := array_remove(leggi_nuove, u.nuova);
    end loop;

  elsif tabella = 'sedute' then
    insert into ars_sedute as s (n, data, giorni, odg, odg_url, res_url, provvisorio)
    select n, data, coalesce(giorni,'{}'), coalesce(odg,'{}'), odg_url, res_url, provvisorio
      from jsonb_to_recordset(righe) as x(n int, data date, giorni date[], odg text[], odg_url text, res_url text, provvisorio boolean)
    on conflict (n) do update set data = excluded.data, giorni = excluded.giorni, odg = excluded.odg,
      odg_url = coalesce(excluded.odg_url, s.odg_url), res_url = coalesce(excluded.res_url, s.res_url), provvisorio = excluded.provvisorio, tolta = false, updated_at = now()
    where (s.data, s.giorni, s.odg, s.odg_url, s.res_url, s.provvisorio, s.tolta) is distinct from
          (excluded.data, excluded.giorni, excluded.odg, coalesce(excluded.odg_url, s.odg_url), coalesce(excluded.res_url, s.res_url), excluded.provvisorio, false);
    get diagnostics tot = row_count;

  elsif tabella = 'convocazioni' then
    insert into ars_convocazioni as c (id, data, foglio, commissione, odg, disdetta)
    select id, data, foglio, commissione, odg, coalesce(disdetta,false)
      from jsonb_to_recordset(righe) as x(id text, data date, foglio int, commissione text, odg text, disdetta boolean)
    on conflict (id) do update set odg = excluded.odg, disdetta = excluded.disdetta, tolta = false, updated_at = now()
    where (c.odg, c.disdetta, c.tolta) is distinct from (excluded.odg, excluded.disdetta, false);
    get diagnostics tot = row_count;

  elsif tabella = 'deputati' then
    insert into ars_deputati as d (nome, gruppo, gruppo_breve, lista, voti, collegio, url, in_carica, palermo, ruoli, recenti)
    select nome, gruppo, gruppo_breve, lista, voti, collegio, url, coalesce(in_carica,true), coalesce(palermo,false), coalesce(ruoli,'{}'), coalesce(recenti, '[]')
      from jsonb_to_recordset(righe) as x(nome text, gruppo text, gruppo_breve text, lista text, voti int, collegio text, url text, in_carica boolean, palermo boolean, ruoli text[], recenti jsonb)
    on conflict (nome) do update set gruppo = excluded.gruppo, gruppo_breve = excluded.gruppo_breve, lista = excluded.lista, voti = excluded.voti, collegio = excluded.collegio,
      url = excluded.url, in_carica = excluded.in_carica, palermo = excluded.palermo, ruoli = excluded.ruoli, recenti = excluded.recenti, updated_at = now()
    where (d.gruppo, d.gruppo_breve, d.lista, d.voti, d.collegio, d.url, d.in_carica, d.palermo, d.ruoli, d.recenti) is distinct from
          (excluded.gruppo, excluded.gruppo_breve, excluded.lista, excluded.voti, excluded.collegio, excluded.url, excluded.in_carica, excluded.palermo, excluded.ruoli, excluded.recenti);
    get diagnostics tot = row_count;

  elsif tabella = 'convocazioni_tolte' then
    update ars_convocazioni set tolta = true, updated_at = now() where not tolta and id in (select jsonb_array_elements_text(righe));
    get diagnostics tot = row_count;

  elsif tabella = 'sedute_tolte' then
    -- solo sedute future sconvocate (quelle passate restano)
    update ars_sedute set tolta = true, updated_at = now() where not tolta and n in (select (jsonb_array_elements_text(righe))::int) and data >= (now() at time zone 'Europe/Rome')::date;
    get diagnostics tot = row_count;

  elsif tabella = 'meta' then
    insert into ars_meta (chiave, valore, updated_at)
    select e.key, e.value, now() from jsonb_each(righe) e
    on conflict (chiave) do update set valore = excluded.valore, updated_at = now();
    get diagnostics tot = row_count;
  else
    raise exception 'tabella sconosciuta: %', tabella;
  end if;
  return jsonb_build_object('scritte', tot, 'nuovi', to_jsonb(nuovi), 'risposte', to_jsonb(risposte), 'leggi_nuove', to_jsonb(leggi_nuove));
end $$;
revoke all on function public.ars_import(text, jsonb) from public, anon, authenticated;
grant execute on function public.ars_import(text, jsonb) to service_role;
