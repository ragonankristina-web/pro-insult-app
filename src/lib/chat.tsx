import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useAuth } from './Auth';
import { demoChat, type Message } from './demo';

// Переписка пациента с врачом — общая для экрана «Чат» и ассистента Брэйни (он отправляет надиктованное).
// Пока демонстрационная и живёт только в памяти; у врача та же переписка показана с его стороны.

type Chat = { messages: Message[]; add: (m: Message) => void };

const ChatContext = createContext<Chat>({ messages: [], add: () => {} });
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() =>
    profile?.role === 'doctor' ? demoChat.map((m) => ({ ...m, mine: !m.mine })) : demoChat,
  );
  const add = useCallback((m: Message) => setMessages((list) => [...list, m]), []);
  return <ChatContext.Provider value={{ messages, add }}>{children}</ChatContext.Provider>;
}
