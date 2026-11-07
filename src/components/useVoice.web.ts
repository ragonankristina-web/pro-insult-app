import { useEffect, useRef, useState } from 'react';

import type { VoiceState } from './useVoice';

// Браузер: распознавание речи Web Speech API (Chrome, Edge, Safari). Слушает, пока enabled.
// onText получает фразу по мере произнесения; вернул true — фраза использована, дальше её не присылаем.
export function useVoice(enabled: boolean, onText: (text: string) => boolean): VoiceState {
  const w = typeof window === 'undefined' ? undefined : (window as any);
  const Recognition = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  const [denied, setDenied] = useState(false);
  const [heard, setHeard] = useState('');
  const handler = useRef(onText);
  useEffect(() => {
    handler.current = onText;
  });

  useEffect(() => {
    if (!enabled || !Recognition) return;
    const rec = new Recognition();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = true;
    let stopped = false;
    const used = new Set<number>();
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text: string = e.results[i][0].transcript;
        setHeard(text.trim());
        if (!used.has(i) && handler.current(text)) used.add(i);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true;
        setDenied(true);
      }
    };
    // Браузер сам останавливает распознавание после паузы — перезапускаем, пока режим включён.
    rec.onend = () => {
      if (stopped) return;
      used.clear();
      try {
        rec.start();
      } catch {}
    };
    try {
      rec.start();
    } catch {}
    return () => {
      stopped = true;
      rec.onend = null;
      rec.abort();
    };
  }, [enabled, Recognition]);

  return { supported: Boolean(Recognition), denied, heard: enabled ? heard : '' };
}
