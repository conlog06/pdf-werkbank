-- PDF Werkbank – Cloud-Abgleich
-- Einmal im Supabase-Dashboard unter „SQL Editor“ ausführen. Kann gefahrlos mehrfach ausgeführt werden.

-- Ordner und Dokumente (Metadaten), je Nutzer
create table if not exists public.wb_items (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  kind        text not null check (kind in ('folder', 'doc')),
  data        jsonb not null default '{}'::jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default clock_timestamp()
);
create index if not exists wb_items_user_updated on public.wb_items (user_id, updated_at);

-- Zeitstempel immer vom Server
create or replace function public.wb_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.user_id := coalesce(new.user_id, auth.uid());
  return new;
end $$;
drop trigger if exists wb_items_touch on public.wb_items;
create trigger wb_items_touch before insert or update on public.wb_items
  for each row execute function public.wb_touch();

-- Jeder sieht und ändert nur seine eigenen Einträge
alter table public.wb_items enable row level security;
drop policy if exists "wb_items eigene" on public.wb_items;
create policy "wb_items eigene" on public.wb_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live-Abgleich zwischen Geräten
do $$ begin
  alter publication supabase_realtime add table public.wb_items;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Dateispeicher (privat): <user-id>/<dokument>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('werkbank', 'werkbank', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "werkbank lesen" on storage.objects;
drop policy if exists "werkbank schreiben" on storage.objects;
drop policy if exists "werkbank ändern" on storage.objects;
drop policy if exists "werkbank löschen" on storage.objects;
create policy "werkbank lesen" on storage.objects for select
  using (bucket_id = 'werkbank' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "werkbank schreiben" on storage.objects for insert
  with check (bucket_id = 'werkbank' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "werkbank ändern" on storage.objects for update
  using (bucket_id = 'werkbank' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "werkbank löschen" on storage.objects for delete
  using (bucket_id = 'werkbank' and (storage.foldername(name))[1] = auth.uid()::text);
