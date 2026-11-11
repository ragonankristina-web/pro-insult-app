-- PRO Инсульт · чат между связанными людьми (пациент ↔ врач, пациент ↔ ухаживающий).
-- Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Выполняется поверх schema.sql и ничего в ней не удаляет; файл можно запускать повторно.

-- ── 1. Сообщения ──────────────────────────────────────────────────────────
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  voice boolean not null default false, -- надиктовано через ассистента Брэйни
  created_at timestamptz not null default now(),
  read_at timestamptz, -- когда получатель открыл переписку
  check (sender_id <> recipient_id)
);

create index if not exists messages_pair on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_unread on public.messages (recipient_id) where read_at is null;

-- ── 2. Права доступа (RLS) ────────────────────────────────────────────────
alter table public.messages enable row level security;

-- Видно только свою переписку.
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));

-- Писать можно только от своего имени и только тому, с кем связь подтверждена.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_linked(auth.uid(), recipient_id));

-- Менять и удалять сообщения нельзя; «прочитано» отмечает функция mark_read.
revoke update, delete on public.messages from authenticated, anon;
revoke all on public.messages from anon;
grant select, insert on public.messages to authenticated;

-- ── 3. Отметить переписку с человеком прочитанной ─────────────────────────
create or replace function public.mark_read(p_other uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null
$$;
revoke execute on function public.mark_read(uuid) from anon, public;
grant execute on function public.mark_read(uuid) to authenticated;

-- ── 4. Связи: приложению нужен id второго человека, чтобы писать ему ───────
drop function if exists public.my_links();
create function public.my_links()
returns table (id bigint, status text, incoming boolean, other_id uuid, other_name text, other_number text,
               other_role text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.status, l.target_id = auth.uid(), p.id, p.full_name, p.personal_number, p.role, l.created_at
  from public.links l
  join public.profiles p on p.id = case when l.requester_id = auth.uid() then l.target_id else l.requester_id end
  where auth.uid() in (l.requester_id, l.target_id) and l.status <> 'declined'
  order by l.created_at desc
$$;
revoke execute on function public.my_links() from anon, public;
grant execute on function public.my_links() to authenticated;

-- ── 5. Мгновенная доставка (Realtime) ─────────────────────────────────────
-- Новые сообщения и отметки «прочитано» приходят в приложение сразу; правила доступа действуют и здесь.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ── 6. Для проверки: связать тестовых пациента и врача (вход для разработчика) ──
-- Номера +7 999 000-00-01 (пациент) и +7 999 000-00-03 (врач). Если кого-то из них ещё нет — ничего не делает.
do $$
declare
  pat uuid;
  doc uuid;
begin
  select p.id into pat from auth.users u join public.profiles p on p.id = u.id
   where u.phone = '79990000001' and p.role = 'patient';
  select p.id into doc from auth.users u join public.profiles p on p.id = u.id
   where u.phone = '79990000003' and p.role = 'doctor';
  if pat is null or doc is null then
    return;
  end if;
  delete from public.links where requester_id = doc and target_id = pat; -- встречный запрос, если был
  insert into public.links (requester_id, target_id, status, responded_at)
  values (pat, doc, 'accepted', now())
  on conflict (requester_id, target_id) do update set status = 'accepted', responded_at = now();
end;
$$;
