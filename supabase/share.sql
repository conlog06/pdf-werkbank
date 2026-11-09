-- pdf werkbank: gemeinsam bearbeiten per link (ab version 1.6)
-- einmal im supabase-dashboard unter "sql editor" ausführen. kann gefahrlos mehrfach ausgeführt werden.

-- freigaben: ein link pro dokument, stand als jsonb mit versionszähler
create table if not exists public.wb_shares (
  token       text primary key,
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc_id      text not null,
  name        text not null default '',
  mode        text not null default 'edit' check (mode in ('edit', 'view')),
  state       jsonb,
  rev         integer not null default 1,
  src_ids     text[] not null default '{}',
  revoked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wb_shares_owner_doc on public.wb_shares (owner, doc_id);
alter table public.wb_shares enable row level security;

drop policy if exists "wb_shares owner" on public.wb_shares;
create policy "wb_shares owner" on public.wb_shares
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- seiten-pdfs, die gäste hinzufügen (z. b. notizpapier, fotos); nur über die funktionen erreichbar
create table if not exists public.wb_share_files (
  token  text not null references public.wb_shares (token) on delete cascade,
  sid    text not null,
  name   text not null default '',
  data   text not null,
  primary key (token, sid)
);
alter table public.wb_share_files enable row level security;

-- lesen per link (auch ohne konto)
create or replace function public.wb_share_get(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'token', s.token, 'name', s.name, 'mode', s.mode, 'rev', s.rev,
    'state', s.state, 'src_ids', to_jsonb(s.src_ids), 'owner', s.owner)
  from public.wb_shares s
  where s.token = p_token and not s.revoked;
$$;

-- schreiben per link: nur wenn p_base dem aktuellen stand entspricht, sonst kommt der neue stand zurück
create or replace function public.wb_share_put(p_token text, p_base integer, p_state jsonb, p_src_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.wb_shares;
begin
  select * into r from public.wb_shares where token = p_token and not revoked for update;
  if not found then
    raise exception 'Link ungültig oder beendet';
  end if;
  if r.mode <> 'edit' and r.owner is distinct from auth.uid() then
    raise exception 'Dieser Link ist nur zum Ansehen';
  end if;
  if octet_length(p_state::text) > 20000000 then
    raise exception 'Stand zu groß';
  end if;
  if r.rev <> p_base then
    return jsonb_build_object('ok', false, 'rev', r.rev, 'state', r.state);
  end if;
  update public.wb_shares
     set state = p_state, rev = r.rev + 1, src_ids = coalesce(p_src_ids, r.src_ids), updated_at = now()
   where token = p_token;
  return jsonb_build_object('ok', true, 'rev', r.rev + 1);
end;
$$;

-- gast fügt eine neue seiten-pdf hinzu (base64, höchstens etwa 12 mb)
create or replace function public.wb_share_add_src(p_token text, p_sid text, p_name text, p_data text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.wb_shares;
begin
  select * into r from public.wb_shares where token = p_token and not revoked;
  if not found then
    raise exception 'Link ungültig oder beendet';
  end if;
  if r.mode <> 'edit' and r.owner is distinct from auth.uid() then
    raise exception 'Dieser Link ist nur zum Ansehen';
  end if;
  if length(p_data) > 17000000 then
    raise exception 'Datei zu groß';
  end if;
  insert into public.wb_share_files (token, sid, name, data)
  values (p_token, p_sid, coalesce(p_name, ''), p_data)
  on conflict (token, sid) do nothing;
  return true;
end;
$$;

create or replace function public.wb_share_src(p_token text, p_sid text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('name', f.name, 'data', f.data)
  from public.wb_share_files f
  join public.wb_shares s on s.token = f.token
  where f.token = p_token and f.sid = p_sid and not s.revoked;
$$;

revoke all on function public.wb_share_get(text) from public;
revoke all on function public.wb_share_put(text, integer, jsonb, text[]) from public;
revoke all on function public.wb_share_add_src(text, text, text, text) from public;
revoke all on function public.wb_share_src(text, text) from public;
grant execute on function public.wb_share_get(text) to anon, authenticated;
grant execute on function public.wb_share_put(text, integer, jsonb, text[]) to anon, authenticated;
grant execute on function public.wb_share_add_src(text, text, text, text) to anon, authenticated;
grant execute on function public.wb_share_src(text, text) to anon, authenticated;

-- original-pdfs des besitzers: öffentlich lesbar nur unter dem geheimen token-ordner
insert into storage.buckets (id, name, public)
values ('werkbank-share', 'werkbank-share', true)
on conflict (id) do update set public = true;

drop policy if exists "werkbank-share owner insert" on storage.objects;
drop policy if exists "werkbank-share owner update" on storage.objects;
drop policy if exists "werkbank-share owner delete" on storage.objects;
drop policy if exists "werkbank-share owner select" on storage.objects;

create policy "werkbank-share owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'werkbank-share' and exists (
    select 1 from public.wb_shares s where s.token = (storage.foldername(objects.name))[1] and s.owner = auth.uid()));

create policy "werkbank-share owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'werkbank-share' and exists (
    select 1 from public.wb_shares s where s.token = (storage.foldername(objects.name))[1] and s.owner = auth.uid()));

create policy "werkbank-share owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'werkbank-share' and exists (
    select 1 from public.wb_shares s where s.token = (storage.foldername(objects.name))[1] and s.owner = auth.uid()));

create policy "werkbank-share owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'werkbank-share' and exists (
    select 1 from public.wb_shares s where s.token = (storage.foldername(objects.name))[1] and s.owner = auth.uid()));
