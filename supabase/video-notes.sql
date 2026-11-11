-- PRO Инсульт · видеокружки в чате.
-- Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run. Выполняется после chat.sql; можно запускать повторно.

-- ── 1. Сообщение может быть видеокружком ──────────────────────────────────
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists media_path text; -- путь к видео в хранилище video-notes
alter table public.messages add column if not exists seconds int; -- длительность кружка
alter table public.messages drop constraint if exists messages_kind;
alter table public.messages add constraint messages_kind check (
  (kind = 'text' and media_path is null) or
  (kind = 'video' and media_path is not null and seconds between 1 and 120)
);

-- Писать можно только связанному человеку; видео — только из своей папки.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_linked(auth.uid(), recipient_id)
    and (kind = 'text' or media_path like auth.uid()::text || '/' || recipient_id::text || '/%')
  );

-- ── 2. Закрытое хранилище видео ───────────────────────────────────────────
-- Путь файла: <id отправителя>/<id получателя>/<время>.webm. До 25 МБ (минута видео — около 8 МБ).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-notes', 'video-notes', false, 26214400, array['video/webm', 'video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Загружать — только в свою папку и только связанному человеку.
drop policy if exists "video_notes_insert" on storage.objects;
create policy "video_notes_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'video-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_linked(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );

-- Смотреть — только отправителю и получателю.
drop policy if exists "video_notes_select" on storage.objects;
create policy "video_notes_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'video-notes'
    and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

-- Удалить своё видео (если сообщение не удалось отправить).
drop policy if exists "video_notes_delete" on storage.objects;
create policy "video_notes_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'video-notes' and (storage.foldername(name))[1] = auth.uid()::text);
