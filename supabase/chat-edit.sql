-- PRO Инсульт · исправление и удаление своих сообщений в чате.
-- Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run. Выполняется после chat.sql; можно запускать повторно.

-- Столбцы видеокружков (на случай, если video-notes.sql ещё не выполняли) и отметки «изменено» / «удалено».
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists seconds int;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

-- У удалённого сообщения текст стирается (пустой) — остальные проверки длины прежние.
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check
  check (deleted_at is not null or char_length(body) between 1 and 4000);

-- Исправить своё текстовое сообщение.
create or replace function public.edit_message(p_id bigint, p_body text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b text := trim(coalesce(p_body, ''));
begin
  if char_length(b) < 1 or char_length(b) > 4000 then
    raise exception 'Сообщение не может быть пустым';
  end if;
  update public.messages set body = b, edited_at = now()
   where id = p_id and sender_id = auth.uid() and kind = 'text' and deleted_at is null;
  if not found then
    raise exception 'Изменить можно только своё текстовое сообщение';
  end if;
end;
$$;

-- Удалить своё сообщение у обоих: текст стирается, остаётся отметка «удалено».
-- Возвращает путь к видео (если это кружок) — приложение удалит и сам файл.
create or replace function public.delete_message(p_id bigint)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  path text;
begin
  update public.messages set deleted_at = now(), body = '', voice = false
   where id = p_id and sender_id = auth.uid() and deleted_at is null
  returning media_path into path;
  if not found then
    raise exception 'Удалить можно только своё сообщение';
  end if;
  return path;
end;
$$;

revoke execute on function public.edit_message(bigint, text), public.delete_message(bigint) from anon, public;
grant execute on function public.edit_message(bigint, text), public.delete_message(bigint) to authenticated;
