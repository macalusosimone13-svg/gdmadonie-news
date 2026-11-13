-- Quando cambia il testo di un atto (es. correzione dei testi uniti), la sintesi
-- fatta sul testo vecchio non vale piu': si svuota e ars-sintesi la rifa'.
-- Applicata il 13/11/2026 (migrazione ars_sintesi_su_testo_nuovo).
create or replace function public.ars_atti_testo_cambiato()
returns trigger language plpgsql as $$
begin
  if new.testo is distinct from old.testo and old.sintesi is not null
     and new.sintesi is not distinct from old.sintesi then
    new.sintesi := null;
    new.sintesi_hash := null;
    new.sintesi_at := null;
  end if;
  return new;
end $$;

drop trigger if exists ars_atti_testo_cambiato on public.ars_atti;
create trigger ars_atti_testo_cambiato before update of testo on public.ars_atti
  for each row execute function public.ars_atti_testo_cambiato();
