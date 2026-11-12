import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from './Auth';
import { demoChat, doctorThreads, type Message } from './demo';
import { usePeople } from './people';
import { backendConfigured, supabase } from './supabase';

// Переписка — общая для экранов чата и ассистента Брэйни (он отправляет надиктованное).
// Чат с подтверждённой связью — настоящий: сообщения в таблице messages (supabase/chat.sql), новые приходят
// сразу через Realtime. Переписка = id профиля собеседника. Пока связи нет — пример из демо-данных
// (DOCTOR_THREAD у пациента, d0…d5 у врача), он живёт только в памяти.

export const DOCTOR_THREAD = 'doctor';

type Row = {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  voice: boolean;
  created_at: string;
  read_at: string | null;
  kind?: 'text' | 'video'; // столбцы видеокружков — после supabase/video-notes.sql
  media_path?: string | null;
  seconds?: number | null;
  edited_at?: string | null; // исправление и удаление — после supabase/chat-edit.sql
  deleted_at?: string | null;
};

type Chat = {
  doctorThread: string; // у пациента — переписка с лечащим врачом (или пример, если врач не привязан)
  isReal: (thread: string) => boolean;
  ready: boolean; // переписка из базы загружена
  error: string | null;
  messages: (thread: string) => Message[];
  add: (thread: string, m: Message) => Promise<string | null>; // текст ошибки или null
  sendVideo: (thread: string, blob: Blob, mime: string, seconds: number) => Promise<string | null>;
  edit: (thread: string, id: Message['id'], text: string) => Promise<string | null>; // своё текстовое
  remove: (thread: string, id: Message['id']) => Promise<string | null>; // своё — удаляется у обоих
  unread: (thread: string) => number; // сколько сообщений собеседника ещё не открыто
  markRead: (thread: string) => void;
};

const ChatContext = createContext<Chat>({
  doctorThread: DOCTOR_THREAD, isReal: () => false, ready: true, error: null,
  messages: () => [], add: async () => null, sendVideo: async () => null, edit: async () => null,
  remove: async () => null, unread: () => 0, markRead: () => {},
});
export const useChat = () => useContext(ChatContext);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0x7fffffff, 7);

// Добавить или обновить строки (по id) и держать их по времени.
const mergeRows = (list: Row[], add: Row[]) => {
  const byId = new Map(list.map((r) => [r.id, r]));
  add.forEach((r) => byId.set(r.id, r));
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

function cleanError(m: string) {
  if (/failed to fetch|network/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.';
  if (/row-level security|violates/i.test(m)) return 'Писать можно только тому, с кем связь подтверждена.';
  if (/messages.*does not exist|relation .*messages/i.test(m)) return 'Чат ещё не включён в базе: выполните supabase/chat.sql.';
  if (/bucket not found|column .*(kind|media_path|seconds)|messages_kind/i.test(m))
    return 'Видеокружки ещё не включены в базе: выполните supabase/video-notes.sql.';
  if (/exceeded|too large|payload/i.test(m)) return 'Видео слишком большое — запишите покороче.';
  if (/(edit|delete)_message|edited_at|deleted_at/i.test(m))
    return 'Исправление и удаление ещё не включены в базе: выполните supabase/chat-edit.sql.';
  return m.replace(/^ERROR:\s*/i, '');
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const me = profile?.id;
  const doctor = profile?.role === 'doctor';
  const people = usePeople();
  const doctorThread = people.doctor?.other_id ?? DOCTOR_THREAD;

  // ── настоящая переписка ──
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me || !backendConfigured) return;
    let alive = true;
    supabase
      .from('messages')
      .select('*')
      .order('id', { ascending: true })
      .limit(2000)
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(cleanError(e.message));
        else setRows((list) => mergeRows(list, (data as Row[]) ?? []));
        setReady(true);
      });
    // Новые сообщения и «прочитано» — сразу; правила доступа пропускают только свою переписку.
    const channel = supabase
      .channel(`messages:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
        const r = p.new as Partial<Row>;
        if (r && typeof r.id === 'number') setRows((list) => mergeRows(list, [r as Row]));
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [me]);

  const byThread = useMemo(() => {
    const out: Record<string, Message[]> = {};
    for (const r of rows) {
      if (r.deleted_at) continue; // удалённое не показываем ни у кого
      const other = r.sender_id === me ? r.recipient_id : r.sender_id;
      const mine = r.sender_id === me;
      (out[other] ??= []).push({
        id: r.id,
        mine,
        text: r.body,
        voice: r.voice,
        at: Date.parse(r.created_at),
        read: mine && Boolean(r.read_at),
        video: r.kind === 'video' && r.media_path ? { path: r.media_path, seconds: r.seconds ?? 0 } : undefined,
        edited: Boolean(r.edited_at),
      });
    }
    return out;
  }, [rows, me]);

  // ── пример переписки (пока связи нет) ──
  const [demo, setDemo] = useState<Record<string, Message[]>>({});
  const [demoRead, setDemoRead] = useState<Record<string, boolean>>({});
  const start = useCallback(
    (thread: string) => (doctor ? doctorThreads[hash(thread) % doctorThreads.length] : demoChat),
    [doctor],
  );

  const isReal = useCallback((thread: string) => backendConfigured && uuid.test(thread), []);

  // В примере переписки id сообщения — его место в списке.
  const demoList = useCallback(
    (thread: string) => (demo[thread] ?? start(thread)).map((m, i) => ({ ...m, id: `d${i}` })),
    [demo, start],
  );

  const messages = useCallback(
    (thread: string) => (isReal(thread) ? byThread[thread] ?? [] : demoList(thread)),
    [isReal, byThread, demoList],
  );

  const add = useCallback(
    async (thread: string, m: Message) => {
      if (!isReal(thread)) {
        setDemo((t) => ({ ...t, [thread]: [...(t[thread] ?? start(thread)), { at: Date.now(), ...m }] }));
        return null;
      }
      const { data, error: e } = await supabase
        .from('messages')
        .insert({ recipient_id: thread, body: m.text.trim(), voice: Boolean(m.voice) })
        .select()
        .single();
      if (e) return cleanError(e.message);
      setRows((list) => mergeRows(list, [data as Row]));
      return null;
    },
    [isReal, start],
  );

  // Видеокружок: файл — в закрытое хранилище video-notes (папка отправителя/получателя), затем сообщение.
  const sendVideo = useCallback(
    async (thread: string, blob: Blob, mime: string, seconds: number) => {
      const text = '🎥 Видеосообщение';
      if (!isReal(thread)) {
        const url = URL.createObjectURL(blob);
        setDemo((t) => ({ ...t, [thread]: [...(t[thread] ?? start(thread)), { mine: true, text, at: Date.now(), video: { url, seconds } }] }));
        return null;
      }
      const path = `${me}/${thread}/${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
      const bucket = supabase.storage.from('video-notes');
      const up = await bucket.upload(path, blob, { contentType: mime, upsert: false });
      if (up.error) return cleanError(up.error.message);
      const { data, error: e } = await supabase
        .from('messages')
        .insert({ recipient_id: thread, body: text, kind: 'video', media_path: path, seconds })
        .select()
        .single();
      if (e) {
        await bucket.remove([path]);
        return cleanError(e.message);
      }
      setRows((list) => mergeRows(list, [data as Row]));
      return null;
    },
    [isReal, start, me],
  );

  const edit = useCallback(
    async (thread: string, id: Message['id'], text: string) => {
      const t = text.trim();
      if (!t) return 'Сообщение не может быть пустым';
      if (!isReal(thread)) {
        const i = Number(String(id).slice(1));
        setDemo((all) => {
          const list = [...(all[thread] ?? start(thread))];
          list[i] = { ...list[i], text: t, edited: true };
          return { ...all, [thread]: list };
        });
        return null;
      }
      const { error: e } = await supabase.rpc('edit_message', { p_id: id, p_body: t });
      if (e) return cleanError(e.message);
      const now = new Date().toISOString();
      setRows((list) => list.map((r) => (r.id === id ? { ...r, body: t, edited_at: now } : r)));
      return null;
    },
    [isReal, start],
  );

  const remove = useCallback(
    async (thread: string, id: Message['id']) => {
      if (!isReal(thread)) {
        const i = Number(String(id).slice(1));
        setDemo((all) => ({ ...all, [thread]: (all[thread] ?? start(thread)).filter((_, k) => k !== i) }));
        return null;
      }
      const { data, error: e } = await supabase.rpc('delete_message', { p_id: id });
      if (e) return cleanError(e.message);
      // Кружок — удаляем и сам файл из хранилища.
      if (typeof data === 'string' && data) await supabase.storage.from('video-notes').remove([data]);
      const now = new Date().toISOString();
      setRows((list) => list.map((r) => (r.id === id ? { ...r, body: '', deleted_at: now } : r)));
      return null;
    },
    [isReal, start],
  );

  const unread = useCallback(
    (thread: string) => {
      if (isReal(thread)) {
        return rows.filter((r) => r.sender_id === thread && r.recipient_id === me && !r.read_at && !r.deleted_at).length;
      }
      if (demoRead[thread]) return 0;
      const list = demo[thread] ?? start(thread);
      let n = 0;
      for (let i = list.length - 1; i >= 0 && !list[i].mine; i--) n++;
      return n;
    },
    [isReal, rows, me, demoRead, demo, start],
  );

  const markRead = useCallback(
    (thread: string) => {
      if (!isReal(thread)) {
        setDemoRead((r) => (r[thread] ? r : { ...r, [thread]: true }));
        return;
      }
      if (!rows.some((r) => r.sender_id === thread && r.recipient_id === me && !r.read_at)) return;
      const now = new Date().toISOString();
      setRows((list) => list.map((r) => (r.sender_id === thread && r.recipient_id === me && !r.read_at ? { ...r, read_at: now } : r)));
      supabase.rpc('mark_read', { p_other: thread }).then(() => {});
    },
    [isReal, rows, me],
  );

  return (
    <ChatContext.Provider value={{ doctorThread, isReal, ready, error, messages, add, sendVideo, edit, remove, unread, markRead }}>
      {children}
    </ChatContext.Provider>
  );
}
