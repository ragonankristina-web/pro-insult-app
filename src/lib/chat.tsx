import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useAuth } from './Auth';
import { demoChat, doctorThreads, type Message } from './demo';

// Переписка — общая для экранов чата и ассистента Брэйни (он отправляет надиктованное).
// У пациента и ухаживающего один чат — с лечащим врачом (DOCTOR_THREAD). У врача — отдельный чат с каждым пациентом
// (по id пациента из кабинета). Пока демонстрационная и живёт только в памяти.

export const DOCTOR_THREAD = 'doctor';

type Chat = {
  messages: (thread: string) => Message[];
  add: (thread: string, m: Message) => void;
  unread: (thread: string) => number; // сколько последних сообщений собеседника ещё не открыто
  markRead: (thread: string) => void;
};

const ChatContext = createContext<Chat>({ messages: () => [], add: () => {}, unread: () => 0, markRead: () => {} });
export const useChat = () => useContext(ChatContext);

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0x7fffffff, 7);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const doctor = profile?.role === 'doctor';
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [read, setRead] = useState<Record<string, boolean>>({});

  // Начало переписки, пока в ней ничего не менялось.
  const start = useCallback(
    (thread: string) => (doctor ? doctorThreads[hash(thread) % doctorThreads.length] : demoChat),
    [doctor],
  );
  const messages = useCallback((thread: string) => threads[thread] ?? start(thread), [threads, start]);
  const add = useCallback(
    (thread: string, m: Message) =>
      setThreads((t) => ({ ...t, [thread]: [...(t[thread] ?? start(thread)), { at: Date.now(), ...m }] })),
    [start],
  );
  const unread = useCallback(
    (thread: string) => {
      if (read[thread]) return 0;
      const list = messages(thread);
      let n = 0;
      for (let i = list.length - 1; i >= 0 && !list[i].mine; i--) n++;
      return n;
    },
    [messages, read],
  );
  const markRead = useCallback((thread: string) => setRead((r) => (r[thread] ? r : { ...r, [thread]: true })), []);

  return <ChatContext.Provider value={{ messages, add, unread, markRead }}>{children}</ChatContext.Provider>;
}
