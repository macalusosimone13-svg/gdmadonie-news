-- Job pg_cron delle rubriche automatiche (applicati il 22/11/2026, qui solo come promemoria).
-- Ogni job gira alle 5 e alle 6 UTC: rubriche-ai e ars-settimana lavorano solo
-- quando in Italia sono le 7 e non rifanno una rubrica gia' scritta nelle 20 ore.
-- pubblica-rubrica fa scrivere la rubrica e, se nasce, la pubblica da sola.
--   rubrica-punto-madonie  '0 5,6 * * 1'  rubriche-ai {tipo:'punto', ambito:'paesi'}
--   rubrica-punto-sicilia  '3 5,6 * * 1'  rubriche-ai {tipo:'punto', ambito:'regionale'}
--   rubrica-punto-italia   '6 5,6 * * 1'  rubriche-ai {tipo:'punto', ambito:'nazionale'}
--   rubrica-focus-madonie  '0 5,6 * * 5'  rubriche-ai {tipo:'dnc'}   (era rubrica-dove-nasci-conta)
--   ars-settimana          '9 5,6 * * 5'  ars-settimana {}
-- Esempio:
select cron.alter_job((select jobid from cron.job where jobname = 'rubrica-punto-madonie'), command := $c$
  select net.http_post(
    url := 'https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/pubblica-rubrica',
    headers := jsonb_build_object('Authorization', private.cron_auth(), 'Content-Type', 'application/json'),
    body := '{"genera":{"funzione":"rubriche-ai","corpo":{"tipo":"punto","ambito":"paesi"}}}'::jsonb,
    timeout_milliseconds := 1000);
$c$);
-- Per tornare alle bozze da approvare a mano: rimettere come url la funzione
-- che scrive (rubriche-ai o ars-settimana) e come body il solo "corpo" con "auto": true.
