-- PRO Инсульт · схема базы v3 (вход по телефону, личные номера, связи).
-- Supabase → SQL Editor → New query → вставить ВЕСЬ файл в пустой редактор → Run.
-- Файл можно выполнять повторно: он сначала удаляет свои старые объекты (и переписку).
-- После него выполните chat.sql — сообщения чата.

-- ── 0. Удаляем старую схему (тестовые данные прошлой версии) ──────────────
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.messages cascade;
drop table if exists public.links cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_doctor(uuid) cascade;
drop function if exists public.my_role() cascade;
drop function if exists public.is_linked(uuid, uuid) cascade;
drop function if exists public.request_link(text) cascade;
drop function if exists public.respond_link(bigint, boolean) cascade;
drop function if exists public.remove_link(bigint) cascade;
drop function if exists public.my_links() cascade;
drop function if exists public.complete_onboarding(text, text, boolean) cascade;
drop sequence if exists public.num_patient;
drop sequence if exists public.num_doctor;
drop sequence if exists public.num_caregiver;

-- ── 1. Профили и личные номера ────────────────────────────────────────────
-- Отдельный счётчик на каждую роль: #пац-0001, #врач-0001, #ухаж-0001.
create sequence public.num_patient;
create sequence public.num_doctor;
create sequence public.num_caregiver;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('patient', 'doctor', 'caregiver')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  personal_number text not null unique,
  consent_at timestamptz not null, -- согласие на обработку персональных данных (152-ФЗ)
  created_at timestamptz not null default now()
);

-- Регистрация завершается после входа по коду: человек выбирает роль, вводит имя и даёт согласие.
-- Номер выдаёт сервер; повторный вызов возвращает уже созданный профиль, роль и номер не меняются.
create function public.complete_onboarding(p_role text, p_full_name text, p_consent boolean)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.profiles;
  name text := left(trim(coalesce(p_full_name, '')), 120);
  num text;
begin
  if me is null then
    raise exception 'Войдите в аккаунт';
  end if;
  select * into existing from public.profiles where id = me;
  if existing.id is not null then
    return existing;
  end if;
  if p_role not in ('patient', 'doctor', 'caregiver') then
    raise exception 'Выберите роль: пациент, ухаживающий или врач';
  end if;
  if char_length(name) < 2 then
    raise exception 'Введите имя и фамилию';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Нужно согласие на обработку персональных данных';
  end if;
  num := case p_role
    when 'patient' then '#пац-' || lpad(nextval('public.num_patient')::text, 4, '0')
    when 'doctor' then '#врач-' || lpad(nextval('public.num_doctor')::text, 4, '0')
    else '#ухаж-' || lpad(nextval('public.num_caregiver')::text, 4, '0')
  end;
  insert into public.profiles (id, role, full_name, personal_number, consent_at)
  values (me, p_role, name, num, now())
  returning * into existing;
  return existing;
end;
$$;

-- ── 2. Связи между людьми ─────────────────────────────────────────────────
-- Пациент ↔ врач, ухаживающий ↔ пациент. Один отправляет запрос по номеру, второй подтверждает.
create table public.links (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, target_id),
  check (requester_id <> target_id)
);

-- true, если у двух людей есть подтверждённая связь (в любую сторону).
create function public.is_linked(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.links l
    where l.status = 'accepted'
      and ((l.requester_id = a and l.target_id = b) or (l.requester_id = b and l.target_id = a))
  )
$$;

-- ── 3. Права доступа (RLS) ────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.links enable row level security;

-- Видно свой профиль и профили тех, с кем связь подтверждена.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_linked(auth.uid(), id));

-- Менять можно только своё имя. Роль и номер защищены на уровне столбцов.
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- Свои связи видно; создавать и менять их можно только через функции ниже.
create policy "links_select" on public.links for select to authenticated
  using (auth.uid() in (requester_id, target_id));
revoke insert, update, delete on public.links from authenticated, anon;

-- ── 4. Функции для приложения ─────────────────────────────────────────────
-- Отправить запрос на связь по личному номеру. Возвращает имя и роль адресата.
create function public.request_link(p_number text)
returns table (full_name text, role text)
language plpgsql security definer set search_path = ''
as $$
declare
  me public.profiles;
  them public.profiles;
  num text := lower(replace(trim(p_number), ' ', ''));
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Войдите в аккаунт';
  end if;
  if num <> '' and left(num, 1) <> '#' then
    num := '#' || num;
  end if;
  select * into them from public.profiles where lower(personal_number) = num;
  if them.id is null then
    raise exception 'Пользователь с номером % не найден', p_number;
  end if;
  if them.id = me.id then
    raise exception 'Это ваш собственный номер';
  end if;
  if not ((me.role, them.role) in (('patient', 'doctor'), ('doctor', 'patient'),
                                   ('caregiver', 'patient'), ('patient', 'caregiver'))) then
    raise exception 'Так связать нельзя: пациента связывают с врачом или с ухаживающим';
  end if;
  if exists (select 1 from public.links l
             where ((l.requester_id = me.id and l.target_id = them.id)
                 or (l.requester_id = them.id and l.target_id = me.id))
               and l.status = 'accepted') then
    raise exception 'Вы уже связаны';
  end if;

  -- Если второй человек уже прислал нам запрос, встречный запрос просто подтверждает связь.
  update public.links set status = 'accepted', responded_at = now()
   where requester_id = them.id and target_id = me.id and status = 'pending';
  if found then
    return query select them.full_name, them.role;
    return;
  end if;

  insert into public.links (requester_id, target_id)
  values (me.id, them.id)
  on conflict (requester_id, target_id)
  do update set status = 'pending', created_at = now(), responded_at = null;

  return query select them.full_name, them.role;
end;
$$;

-- Принять или отклонить входящий запрос.
create function public.respond_link(p_id bigint, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.links
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_id and target_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Запрос не найден или уже обработан';
  end if;
end;
$$;

-- Удалить связь или отменить свой запрос (может любая из двух сторон).
create function public.remove_link(p_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.links where id = p_id and auth.uid() in (requester_id, target_id);
  if not found then
    raise exception 'Связь не найдена';
  end if;
end;
$$;

-- Все мои связи и запросы с данными второго человека.
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

revoke execute on function public.request_link(text), public.respond_link(bigint, boolean),
  public.remove_link(bigint), public.my_links(), public.is_linked(uuid, uuid) from anon, public;
grant execute on function public.request_link(text), public.respond_link(bigint, boolean),
  public.remove_link(bigint), public.my_links() to authenticated;
revoke execute on function public.complete_onboarding(text, text, boolean) from anon, public;
grant execute on function public.complete_onboarding(text, text, boolean) to authenticated;
-- is_linked вызывается внутри правила доступа к профилям, поэтому нужна роли authenticated.
grant execute on function public.is_linked(uuid, uuid) to authenticated;
