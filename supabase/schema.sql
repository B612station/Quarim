-- ============================================================
-- QUARIM — Schéma Supabase
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────
create table profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text unique not null,
  full_name   text not null,
  role        text not null check (role in ('admin','employee')),
  pole        text,   -- ex: RH, Marketing, Juridique, Commercial…
  org_name    text default 'Mon Organisation',
  created_at  timestamptz default now()
);
alter table profiles enable row level security;

create policy "Profil visible par les membres de la même org"
  on profiles for select using (auth.uid() is not null);

create policy "Mise à jour de son propre profil"
  on profiles for update using (auth.uid() = id);

-- ── BRIEFS (dirigeant) ─────────────────────────────────────
create table briefs (
  id            uuid default uuid_generate_v4() primary key,
  author_id     uuid references profiles(id) on delete cascade,
  week_date     date not null,
  transcript    text,
  summary       jsonb,
  created_at    timestamptz default now()
);
alter table briefs enable row level security;

create policy "Brief lisible par tous"
  on briefs for select using (auth.uid() is not null);

create policy "Brief créé par admin uniquement"
  on briefs for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── AVANCÉES (employés) ────────────────────────────────────
create table avancees (
  id             uuid default uuid_generate_v4() primary key,
  author_id      uuid references profiles(id) on delete cascade,
  transcript     text,
  resume         text,
  confidentiel   boolean default false,
  week_date      date default current_date,
  created_at     timestamptz default now()
);
alter table avancees enable row level security;

-- Admin voit tout
create policy "Admin voit toutes les avancées"
  on avancees for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Employé voit les siennes + les non-confidentielles des autres
create policy "Employé voit avancées non confidentielles"
  on avancees for select using (
    auth.uid() = author_id
    or (
      confidentiel = false
      and exists (select 1 from profiles where id = auth.uid() and role = 'employee')
    )
  );

create policy "Employé crée ses avancées"
  on avancees for insert with check (auth.uid() = author_id);

create policy "Employé modifie ses avancées"
  on avancees for update using (auth.uid() = author_id);

-- ── CANAUX ────────────────────────────────────────────────
create table channels (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  pole        text,    -- null = canal général (tout le monde)
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);
alter table channels enable row level security;

create policy "Canaux visibles par tous"
  on channels for select using (auth.uid() is not null);

create policy "Canal créé par admin"
  on channels for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Canal supprimé par admin"
  on channels for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── MESSAGES (canaux) ──────────────────────────────────────
create table messages (
  id             uuid default uuid_generate_v4() primary key,
  channel_id     uuid references channels(id) on delete cascade,
  author_id      uuid references profiles(id) on delete cascade,
  content        text not null,
  confidentiel   boolean default false,
  created_at     timestamptz default now()
);
alter table messages enable row level security;

-- Admin voit tout
create policy "Admin voit tous les messages"
  on messages for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Employé voit ses messages + non confidentiels du canal
create policy "Employé voit messages non confidentiels"
  on messages for select using (
    auth.uid() = author_id
    or (
      confidentiel = false
      and exists (
        select 1 from channels c
        join profiles p on p.id = auth.uid()
        where c.id = channel_id
        and (c.pole is null or c.pole = p.pole)
      )
    )
  );

create policy "Employé poste dans les canaux de son pôle ou généraux"
  on messages for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from channels c
      join profiles p on p.id = auth.uid()
      where c.id = channel_id
      and (c.pole is null or c.pole = p.pole or p.role = 'admin')
    )
  );

create policy "Auteur supprime son message"
  on messages for delete using (auth.uid() = author_id);

-- ── ESCALADES ─────────────────────────────────────────────
create table escalades (
  id              uuid default uuid_generate_v4() primary key,
  author_id       uuid references profiles(id) on delete cascade,
  question        text not null,
  context_quarim  text,
  reponse         text,
  reponse_by      uuid references profiles(id),
  reponse_at      timestamptz,
  created_at      timestamptz default now()
);
alter table escalades enable row level security;

create policy "Admin voit toutes les escalades"
  on escalades for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Employé voit ses escalades"
  on escalades for select using (auth.uid() = author_id);

create policy "Employé crée une escalade"
  on escalades for insert with check (auth.uid() = author_id);

create policy "Admin répond aux escalades"
  on escalades for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── REALTIME ──────────────────────────────────────────────
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table escalades;
alter publication supabase_realtime add table avancees;

-- ── CANAUX PAR DÉFAUT ─────────────────────────────────────
-- (à exécuter après avoir créé votre premier compte admin)
-- insert into channels (name, description, pole, created_by)
-- values ('général', 'Canal ouvert à toute l''équipe', null, '<votre-user-id>');
