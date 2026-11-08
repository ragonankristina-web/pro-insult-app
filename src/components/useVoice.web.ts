import { useEffect, useRef, useState } from 'react';

import type { VoiceState } from './useVoice';

// Браузер: распознавание речи Web Speech API (Chrome, Edge, Safari).
// Браузер даёт держать только одно распознавание, поэтому оно общее: работает, пока его слушает
// хоть один экран (Брэйни, игра), и рассылает фразы всем. Каждый сам решает, его ли это фраза.

type Listener = { onResult: (key: string, text: string, final: boolean) => void; onDenied: () => void };

const w = typeof window === 'undefined' ? undefined : (window as any);
const Recognition = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;

const listeners = new Set<Listener>();
let rec: any = null;
let session = 0; // номер сеанса: после перезапуска браузер снова нумерует фразы с нуля
let denied = false;
let muted = false;

// Пока Брэйни говорит вслух, микрофон слышит его самого — такие фразы не рассылаем.
export function setVoiceMuted(on: boolean) {
  muted = on;
}

function sync() {
  if (listeners.size && !rec && !denied && Recognition) start();
  if (!listeners.size && rec) {
    const r = rec;
    rec = null;
    r.onend = null;
    r.abort();
  }
}

function start() {
  const r = new Recognition();
  r.lang = 'ru-RU';
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (e: any) => {
    if (muted) return;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text: string = e.results[i][0].transcript;
      listeners.forEach((l) => l.onResult(`${session}:${i}`, text, e.results[i].isFinal));
    }
  };
  r.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      denied = true;
      listeners.forEach((l) => l.onDenied());
    }
  };
  // Браузер сам останавливает распознавание после паузы — перезапускаем, пока кто-то слушает.
  r.onend = () => {
    if (rec !== r) return;
    session++;
    if (denied || !listeners.size) return void (rec = null);
    try {
      r.start();
    } catch {
      rec = null;
    }
  };
  rec = r;
  try {
    r.start();
  } catch {
    rec = null;
  }
}

// onText получает фразу по мере произнесения (final — фраза закончена);
// вернул true — фраза использована, дальше её этому слушателю не присылаем.
export function useVoice(enabled: boolean, onText: (text: string, final: boolean) => boolean): VoiceState {
  const [isDenied, setDenied] = useState(denied);
  const [heard, setHeard] = useState('');
  const handler = useRef(onText);
  useEffect(() => {
    handler.current = onText;
  });

  useEffect(() => {
    if (!enabled || !Recognition) return;
    const used = new Set<string>();
    const l: Listener = {
      onResult: (key, text, final) => {
        setHeard(text.trim());
        if (!used.has(key) && handler.current(text, final)) used.add(key);
      },
      onDenied: () => setDenied(true),
    };
    listeners.add(l);
    sync();
    return () => {
      listeners.delete(l);
      sync();
    };
  }, [enabled]);

  return { supported: Boolean(Recognition), denied: isDenied, heard: enabled ? heard : '' };
}
