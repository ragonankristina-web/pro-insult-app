import { useSyncExternalStore } from 'react';

// Настроение Брэйни — общее для всего приложения: его меняют ответы и просьбы пациента, упражнения
// и собственные слова Брэйни. Анимации (assets/brainy) начинаются и кончаются в одной спокойной позе:
// реакция играет один полный цикл и возвращает к спокойной позе — или к разговору, если Брэйни ещё говорит.

export type Reaction = 'happy' | 'sad' | 'angry';
export type Mood = 'idle' | 'talk' | Reaction;

const LENGTH: Record<Reaction, number> = { happy: 4500, sad: 5000, angry: 4500 }; // мс, длина ролика

let state = { mood: 'idle' as Mood, stamp: 0 }; // stamp — когда началось: та же эмоция заново играет с начала
let reaction: { mood: Reaction; until: number } | null = null;
let talking = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(mood: Mood, restart = false) {
  if (mood === state.mood && !restart) return;
  state = { mood, stamp: Date.now() };
  listeners.forEach((l) => l());
}

function update() {
  if (reaction && reaction.until <= Date.now()) reaction = null;
  set(reaction ? reaction.mood : talking ? 'talk' : 'idle');
}

// Показать эмоцию. Если та же уже играет и прошла меньше половины — не перезапускаем (не дёргается).
export function react(mood: Reaction) {
  const now = Date.now();
  if (reaction?.mood === mood && reaction.until - now > LENGTH[mood] / 2) return;
  reaction = { mood, until: now + LENGTH[mood] };
  set(mood, true);
  clearTimeout(timer);
  timer = setTimeout(update, LENGTH[mood] + 30);
}

export const reacting = () => Boolean(reaction && reaction.until > Date.now());

// Брэйни говорит вслух — анимация разговора (пока не идёт другая эмоция).
export function setTalking(on: boolean) {
  talking = on;
  update();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

export function useMood() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// Большой Брэйни посередине экрана (BrainyStage): пока он виден, маленький в углу прячется.
let stages = 0;
const stageListeners = new Set<() => void>();
const stageChanged = () => stageListeners.forEach((l) => l());
const stageSubscribe = (l: () => void) => {
  stageListeners.add(l);
  return () => stageListeners.delete(l);
};

export function stageOn() {
  stages++;
  stageChanged();
}

export function stageOff() {
  stages--;
  stageChanged();
}

export const useStageActive = () => useSyncExternalStore(stageSubscribe, () => stages > 0, () => false);
