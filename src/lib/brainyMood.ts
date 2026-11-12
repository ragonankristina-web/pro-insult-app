import { useSyncExternalStore } from 'react';

// Настроение Брэйни — общее для всего приложения: его меняют ответы и просьбы пациента, упражнения
// и собственные слова Брэйни. Анимации (assets/brainy) начинаются и кончаются в одной спокойной позе:
// реакция играет один полный цикл и возвращает к спокойной позе — или к разговору, если Брэйни ещё говорит.
// Пока его не трогают: раз в 3 минуты переминается с ноги на ногу, а через 5,5 минуты без действий
// засыпает (зевает → спит). Любое действие в приложении его будит (просыпается → спокойная поза).

export type Reaction = 'happy' | 'sad' | 'angry';
export type Mood = 'idle' | 'talk' | 'tired' | 'fallAsleep' | 'sleep' | 'wakeUp' | Reaction;

const LENGTH: Record<Reaction, number> = { happy: 4500, sad: 5000, angry: 4500 }; // мс, длина ролика
const TIRED = 7000; // переминается с ноги на ногу
const FALL_ASLEEP = 3000; // зевает и закрывает глаза — кончается кадром, с которого начинается сон
const WAKE_UP = 2000; // просыпается — кончается спокойной позой
const TIRED_EVERY = 3 * 60_000;
const SLEEP_AFTER = 5.5 * 60_000; // без действий в приложении

let state = { mood: 'idle' as Mood, stamp: 0 }; // stamp — когда началось: та же эмоция заново играет с начала
let reaction: { mood: Reaction; until: number } | null = null;
let talking = false;
let tiredUntil = 0;
let lastTired = Date.now();
let lastActive = Date.now();
let phase: 'awake' | 'falling' | 'asleep' | 'waking' = 'awake';
let queued: Reaction | null = null; // эмоция, попросили во сне — сыграет, когда проснётся
let timer: ReturnType<typeof setTimeout> | undefined;
let phaseTimer: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function set(mood: Mood, restart = false) {
  if (mood === state.mood && !restart) return;
  state = { mood, stamp: Date.now() };
  listeners.forEach((l) => l());
}

function update() {
  const now = Date.now();
  if (reaction && reaction.until <= now) reaction = null;
  if (phase === 'falling') return set('fallAsleep');
  if (phase === 'asleep') return set('sleep');
  if (phase === 'waking') return set('wakeUp');
  set(reaction ? reaction.mood : talking ? 'talk' : tiredUntil > now ? 'tired' : 'idle');
}

function play(mood: Reaction) {
  reaction = { mood, until: Date.now() + LENGTH[mood] };
  set(mood, true);
  clearTimeout(timer);
  timer = setTimeout(update, LENGTH[mood] + 30);
}

// Раз в 5 секунд: не пора ли переминаться или засыпать.
function tick() {
  const now = Date.now();
  if (phase !== 'awake' || talking || reaction || tiredUntil > now) return;
  if (now - lastActive > SLEEP_AFTER) {
    phase = 'falling';
    update();
    phaseTimer = setTimeout(() => {
      phase = 'asleep';
      update();
    }, FALL_ASLEEP);
    return;
  }
  if (now - lastTired > TIRED_EVERY) {
    lastTired = now;
    tiredUntil = now + TIRED;
    update();
    setTimeout(update, TIRED + 30);
  }
}

// Действие в приложении (касание, клик, клавиша, голос): Брэйни не уснёт, а спящий — проснётся.
export function touch() {
  lastActive = Date.now();
  if (phase === 'awake' || phase === 'waking') return;
  clearTimeout(phaseTimer);
  phase = 'waking';
  update();
  phaseTimer = setTimeout(() => {
    phase = 'awake';
    lastTired = Date.now();
    const next = queued;
    queued = null;
    if (next) play(next);
    else update();
  }, WAKE_UP);
}

// Показать эмоцию. Если та же уже играет и прошла меньше половины — не перезапускаем (не дёргается).
export function react(mood: Reaction) {
  touch();
  if (phase !== 'awake') {
    queued = mood;
    return;
  }
  tiredUntil = 0;
  if (reaction?.mood === mood && reaction.until - Date.now() > LENGTH[mood] / 2) return;
  play(mood);
}

export const reacting = () => Boolean(reaction && reaction.until > Date.now());

// Брэйни говорит вслух — анимация разговора (пока не идёт другая эмоция; спящий сначала проснётся).
export function setTalking(on: boolean) {
  talking = on;
  if (on) {
    touch();
    tiredUntil = 0;
  }
  update();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  ticker ??= setInterval(tick, 5000);
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
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
