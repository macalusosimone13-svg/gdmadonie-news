-- Sezione ARS: archivio dell'Assemblea Regionale Siciliana (XVIII legislatura).
-- Tabelle nuove, lettura pubblica (RLS), scrittura solo admin o funzione ars-import.
do $$ begin
  if not exists (select 1 from pg_ts_config where cfgname = 'ars_it') then
    create text search configuration public.ars_it (copy = pg_catalog.italian);
    alter text search configuration public.ars_it alter mapping for hword, hword_part, word with extensions.unaccent, italian_stem;
  end if;
end $$;

create table if not exists public.ars_sedute (
  n int primary key, data date, giorni date[] not null default '{}', odg text[] not null default '{}',
  odg_url text, res_url text, provvisorio boolean, updated_at timestamptz not null default now()
);

create table if not exists public.ars_atti (
  k text primary key,
  tipo text not null check (tipo in ('I','P','M','D')),
  n int not null,
  titolo text not null,
  data date, data_presentazione date,
  firmatari text[] not null default '{}', iniziativa text, gruppo text,
  destinatari text[] not null default '{}', commissione text,
  seduta int, luoghi text[] not null default '{}', pagina int, fonte text, url_doc text,
  iter jsonb, testo text, risposta jsonb, orale jsonb,
  ha_risposta boolean not null default false,
  sintesi jsonb, sintesi_hash text, sintesi_at timestamptz, tema text,
  bloccati text[] not null default '{}', correzioni jsonb not null default '[]',
  creato_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    setweight(to_tsvector('public.ars_it'::regconfig, coalesce(titolo,'')), 'A') ||
    setweight(to_tsvector('public.ars_it'::regconfig, left(coalesce(testo,''), 30000)), 'B') ||
    setweight(to_tsvector('public.ars_it'::regconfig, left(coalesce(risposta->>'txt','') || ' ' || coalesce(orale->>'txt',''), 12000)), 'C') ||
    setweight(to_tsvector('public.ars_it'::regconfig, array_to_string(luoghi,' ') || ' ' || array_to_string(firmatari,' ') || ' ' || coalesce(commissione,'') || ' ' || coalesce(sintesi->>'breve','')), 'B')
  ) stored
);
create index if not exists ars_atti_fts on public.ars_atti using gin (fts);
create index if not exists ars_atti_data on public.ars_atti (data desc, n desc);
create index if not exists ars_atti_tipo on public.ars_atti (tipo, data desc);
create index if not exists ars_atti_luoghi on public.ars_atti using gin (luoghi);
create index if not exists ars_atti_firmatari on public.ars_atti using gin (firmatari);

create table if not exists public.ars_leggi (
  id text primary key, ddl text not null, num text, titolo text, titolo_breve text,
  data date, seduta int, approvata boolean,
  favorevoli int, contrari int, astenuti int, presenti int, pagina int,
  commissione text, gurs text, extra jsonb, manuale boolean not null default false,
  updated_at timestamptz not null default now(),
  fts tsvector generated always as (
    setweight(to_tsvector('public.ars_it'::regconfig, coalesce(titolo,'') || ' ' || coalesce(titolo_breve,'')), 'A') ||
    setweight(to_tsvector('public.ars_it'::regconfig, coalesce(extra->>'testo_ricerca','')), 'B')
  ) stored
);
create index if not exists ars_leggi_fts on public.ars_leggi using gin (fts);

create table if not exists public.ars_misure (
  id text primary key,
  legge_id text not null references public.ars_leggi(id) on delete cascade,
  ordine int not null default 0, articolo text not null, tema text, titolo text not null, sintesi text,
  mln numeric, origine text, locale boolean not null default false, per text[] not null default '{}',
  req_stato text, req_testo text, dettagli jsonb not null default '[]', avviso_url text, avviso_at timestamptz,
  fts tsvector generated always as (
    to_tsvector('public.ars_it'::regconfig, coalesce(titolo,'') || ' ' || coalesce(sintesi,'') || ' ' || coalesce(tema,'') || ' ' || array_to_string(per,' ') || ' ' || coalesce(req_testo,'') || ' ' || coalesce(dettagli::text,''))
  ) stored
);
create index if not exists ars_misure_fts on public.ars_misure using gin (fts);

create table if not exists public.ars_convocazioni (
  id text primary key, data date not null, foglio int, commissione text, odg text,
  disdetta boolean not null default false, updated_at timestamptz not null default now(),
  fts tsvector generated always as (to_tsvector('public.ars_it'::regconfig, coalesce(commissione,'') || ' ' || coalesce(odg,''))) stored
);
create index if not exists ars_conv_data on public.ars_convocazioni (data desc);
create index if not exists ars_conv_fts on public.ars_convocazioni using gin (fts);

create table if not exists public.ars_deputati (
  nome text primary key, gruppo text, lista text, voti int, collegio text, url text,
  in_carica boolean not null default true, palermo boolean not null default false,
  ruoli text[] not null default '{}', updated_at timestamptz not null default now()
);

create table if not exists public.ars_meta (chiave text primary key, valore jsonb, updated_at timestamptz not null default now());
create table if not exists public.ars_config (chiave text primary key, valore text not null);

create table if not exists public.ars_iscrizioni (
  id uuid primary key default gen_random_uuid(), email text not null, chiave text not null,
  token text not null default encode(extensions.gen_random_bytes(18), 'hex'),
  confermata boolean not null default false, creato_at timestamptz not null default now(), confermata_at timestamptz,
  unique (email, chiave)
);
create table if not exists public.ars_notifiche (
  iscrizione_id uuid not null references public.ars_iscrizioni(id) on delete cascade,
  rif text not null, inviata_at timestamptz not null default now(), primary key (iscrizione_id, rif)
);
create table if not exists public.ars_cerca_log (id bigserial primary key, iph text, domanda text, at timestamptz not null default now());
create index if not exists ars_cerca_log_at on public.ars_cerca_log (iph, at desc);

alter table public.ars_sedute enable row level security;
alter table public.ars_atti enable row level security;
alter table public.ars_leggi enable row level security;
alter table public.ars_misure enable row level security;
alter table public.ars_convocazioni enable row level security;
alter table public.ars_deputati enable row level security;
alter table public.ars_meta enable row level security;
alter table public.ars_config enable row level security;
alter table public.ars_iscrizioni enable row level security;
alter table public.ars_notifiche enable row level security;
alter table public.ars_cerca_log enable row level security;

do $$ declare t text; begin
  foreach t in array array['ars_sedute','ars_atti','ars_leggi','ars_misure','ars_convocazioni','ars_deputati','ars_meta'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='lettura pubblica') then
      execute format('create policy "lettura pubblica" on public.%I for select using (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='modifica admin') then
      execute format('create policy "modifica admin" on public.%I for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))', t);
    end if;
  end loop;
end $$;
