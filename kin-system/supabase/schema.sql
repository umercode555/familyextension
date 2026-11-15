-- Kin schema. Run once in Supabase: SQL Editor > New query > paste > Run.
create or replace function public.kin_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create table if not exists public.contacts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, relation text, notes text,
  paused boolean not null default false,
  wa_name text,                       -- exact WhatsApp chat title, verified on the laptop
  last_sent bigint, sent_count int not null default 0,
  awaiting_since bigint, last_reply bigint, last_incoming text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

create table if not exists public.items(          -- voice recordings + text templates
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  kind text not null check (kind in ('voice','text')),
  title text not null default 'Untitled', category text, text text,
  duration real, mime text, filename text,
  storage_path text,                  -- <user_id>/<item_id>.<ext> in bucket "voice"
  sent_count int not null default 0, last_sent bigint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

create table if not exists public.schedules(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  type text not null default 'daily', days int[] not null default '{}', dates text[] not null default '{}',
  every_n int not null default 1, anchor text, times text[] not null default '{}',
  jitter int not null default 0, mode text not null default 'rotate', active boolean not null default true,
  item_ids text[] not null default '{}', fixed_by_date jsonb not null default '{}'::jsonb, created_ms bigint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

create table if not exists public.instances(      -- scheduled message instances awaiting approval (created by Chrome)
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  schedule_id text, item_id text, planned_ms bigint, status text not null default 'pending',
  snooze_until bigint, done_at bigint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

create table if not exists public.events(         -- message history, replies, skips, misses
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  type text not null, title text, detail text, ts bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

do $$ declare t text; begin
  foreach t in array array['contacts','items','schedules','instances','events'] loop
    execute format('create index if not exists %I on public.%I(user_id, updated_at)', t||'_sync_idx', t);
    execute format('drop trigger if exists %I on public.%I', t||'_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.kin_touch()', t||'_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t||'_own', t);
  end loop; end $$;

-- Private audio bucket; each user can only touch files under their own <user_id>/ folder.
insert into storage.buckets (id, name, public) values ('voice','voice',false) on conflict (id) do nothing;
drop policy if exists "voice_select" on storage.objects; drop policy if exists "voice_insert" on storage.objects;
drop policy if exists "voice_update" on storage.objects; drop policy if exists "voice_delete" on storage.objects;
create policy "voice_select" on storage.objects for select to authenticated using (bucket_id='voice' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "voice_insert" on storage.objects for insert to authenticated with check (bucket_id='voice' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "voice_update" on storage.objects for update to authenticated using (bucket_id='voice' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "voice_delete" on storage.objects for delete to authenticated using (bucket_id='voice' and (storage.foldername(name))[1]=auth.uid()::text);

-- Realtime (optional, for future push-style sync). Clients currently poll every few seconds.
do $$ begin
  begin alter publication supabase_realtime add table public.contacts, public.items, public.schedules, public.instances, public.events;
  exception when others then null; end; end $$;
