import * as Speech from 'expo-speech';

import { loadVoice, synthesize, voiceReady } from './piperWeb';

// Браузер: Брэйни говорит голосом «Руслан» (Piper, на устройстве). Пока голос загружается в первый раз
// или если что-то не вышло — говорит голосом браузера, чтобы ответ не пропал.

export const voiceName = 'Руслан (Piper · корпус RUSLAN, CC BY-NC-SA 4.0)';

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
let turn = 0; // новая фраза отменяет ещё не начатую старую

function deviceSay(text: string, onDone: () => void) {
  Speech.speak(text, { language: 'ru-RU', rate: 0.85, onDone, onStopped: onDone, onError: onDone });
}

// Звук в браузере разрешён только после нажатия — создаём AudioContext по нажатию и начинаем грузить голос.
export function warmUpVoice() {
  try {
    ctx ??= new AudioContext();
    ctx.resume().catch(() => {});
  } catch {
    // без Web Audio — останется голос браузера
  }
  loadVoice().catch(() => {});
}

export function say(text: string, onDone: () => void) {
  stopSaying();
  const my = ++turn;
  if (!voiceReady() || !ctx) {
    loadVoice().catch(() => {});
    return deviceSay(text, onDone);
  }
  const audio = ctx;
  synthesize(text)
    .then(async ({ pcm, sampleRate }) => {
      if (my !== turn) return onDone();
      if (audio.state !== 'running') await audio.resume();
      if (audio.state !== 'running' || !pcm.length) throw new Error('audio');
      const buf = audio.createBuffer(1, pcm.length, sampleRate);
      buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
      const src = audio.createBufferSource();
      src.buffer = buf;
      src.connect(audio.destination);
      src.onended = () => {
        if (current === src) current = null;
        onDone();
      };
      current = src;
      src.start();
    })
    .catch(() => {
      if (my === turn) deviceSay(text, onDone);
      else onDone();
    });
}

export function stopSaying() {
  turn++;
  try {
    current?.stop();
  } catch {
    // уже закончил
  }
  current = null;
  Speech.stop();
}
