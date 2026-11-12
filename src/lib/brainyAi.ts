import { supabase } from './supabase';

// Разговор Брэйни с ИИ (GigaChat) — через функцию Supabase brainy-chat (supabase/functions/brainy-chat):
// ключ ИИ хранится там, приложение отправляет последние реплики и немного сведений о собеседнике.

export type Turn = { role: 'user' | 'assistant'; content: string };
export type AiContext = { name?: string; role?: string; week?: string; left?: string[] };
export type AiAnswer = { reply: string } | { error: 'off' | 'busy' | 'limit' | 'failed' };

export async function askBrainy(turns: Turn[], context: AiContext): Promise<AiAnswer> {
  const { data, error } = await supabase.functions.invoke('brainy-chat', { body: { messages: turns, context } });
  if (error) {
    // Ответ функции с ошибкой — читаем её код; функции нет или нет связи — ИИ недоступен.
    let code = '';
    let status = 0;
    try {
      const res = (error as { context?: Response }).context;
      status = res?.status ?? 0;
      code = (await res?.json())?.error ?? '';
    } catch {
      // не JSON — значит, функции нет
    }
    if (code === 'busy' || status === 429) return { error: code === 'rate_limited' ? 'limit' : 'busy' };
    if (code === 'not_configured' || status === 404 || status === 0) return { error: 'off' };
    return { error: 'failed' };
  }
  const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
  return reply ? { reply } : { error: 'failed' };
}

export const aiTrouble: Record<'busy' | 'limit' | 'failed', string> = {
  busy: 'Я немного задумался. Повтори, пожалуйста, ещё раз.',
  limit: 'Давай немного передохнём от разговоров и вернёмся чуть позже.',
  failed: 'Сейчас у меня не получается подумать. Попробуем ещё раз чуть позже.',
};
