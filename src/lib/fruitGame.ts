// «Фруктовый сад» — упражнение раздела «Мышление»: разложить фрукты по корзинам с такой же картинкой.
// Правила и уровни — из исходной мини-игры (game.js), картинки — assets/exercises/think/fruit.

export type Fruit = 'apple' | 'pear' | 'lemon' | 'grape';

export const fruitInfo: Record<Fruit, { name: string; single: string; img: number }> = {
  apple: { name: 'Яблоки', single: 'Яблоко', img: require('../../assets/exercises/think/fruit/apple.png') },
  pear: { name: 'Груши', single: 'Груша', img: require('../../assets/exercises/think/fruit/pear.png') },
  lemon: { name: 'Лимоны', single: 'Лимон', img: require('../../assets/exercises/think/fruit/lemon.png') },
  grape: { name: 'Виноград', single: 'Виноград', img: require('../../assets/exercises/think/fruit/grape.png') },
};
export const basketImg = require('../../assets/exercises/think/fruit/basket.png');
export const pipeImg = require('../../assets/exercises/think/fruit/pipe.png');

// seconds — сколько падает фрукт в режиме «на время»; swap — корзины меняются местами каждые 4 фрукта.
export const levels: { name: string; types: Fruit[]; count: number; seconds: number; swap: boolean }[] = [
  { name: 'Первые фрукты', types: ['pear', 'apple'], count: 8, seconds: 8, swap: false },
  { name: 'Ловим ритм', types: ['lemon', 'apple'], count: 12, seconds: 6, swap: false },
  { name: 'Новый урожай', types: ['grape', 'pear'], count: 14, seconds: 5, swap: false },
  { name: 'Три корзины', types: ['lemon', 'apple', 'pear'], count: 15, seconds: 7, swap: false },
  { name: 'Меняем места', types: ['grape', 'apple', 'lemon'], count: 18, seconds: 5.5, swap: true },
  { name: 'Мастер сада', types: ['apple', 'pear', 'lemon', 'grape'], count: 24, seconds: 6, swap: true },
];

export type Round = {
  level: number;
  queue: Fruit[];
  slots: Fruit[]; // корзины слева направо
  position: number;
  correct: number;
  wrong: number;
  missed: number;
  attempts: number;
  collected: Partial<Record<Fruit, number>>;
};

function shuffle<T>(a: T[]): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeRound(level: number): Round {
  const l = levels[level];
  return {
    level,
    queue: shuffle(Array.from({ length: l.count }, (_, i) => l.types[i % l.types.length])),
    slots: shuffle(l.types),
    position: 0,
    correct: 0,
    wrong: 0,
    missed: 0,
    attempts: 0,
    collected: {},
  };
}

// Выбор корзины: при ошибке фрукт остаётся на месте, при верном выборе — следующий фрукт.
export function choose(r: Round, slot: number): { round: Round; ok: boolean } {
  const fruit = r.queue[r.position];
  if (r.slots[slot] !== fruit) return { round: { ...r, attempts: r.attempts + 1, wrong: r.wrong + 1 }, ok: false };
  return {
    round: {
      ...r,
      attempts: r.attempts + 1,
      correct: r.correct + 1,
      position: r.position + 1,
      collected: { ...r.collected, [fruit]: (r.collected[fruit] ?? 0) + 1 },
    },
    ok: true,
  };
}

export const miss = (r: Round): Round => ({ ...r, missed: r.missed + 1, position: r.position + 1 });

// На уровнях с перестановкой корзины сдвигаются по кругу каждые 4 фрукта.
export const needsSwap = (r: Round) => levels[r.level].swap && r.position > 0 && r.position % 4 === 0;
export const swapSlots = (r: Round): Round => ({ ...r, slots: [...r.slots.slice(1), r.slots[0]] });

// Номер корзины из распознанной фразы: «два», «вторая», «корзина 3», «левая» / «правая». -1 — не понято.
// Берём последнее подходящее слово — распознавание присылает фразу целиком, по мере произнесения.
const numberWords = [
  ['1', 'один', 'одна', 'одну', 'первая', 'первую', 'первый', 'первой'],
  ['2', 'два', 'две', 'вторая', 'вторую', 'второй'],
  ['3', 'три', 'третья', 'третью', 'третий', 'третьей'],
  ['4', 'четыре', 'четвертая', 'четвертую', 'четвертый', 'четвертой'],
];

export function basketFromSpeech(text: string, count: number): number {
  const ws = text.toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\d]+/u).reverse();
  for (const w of ws) {
    const n = numberWords.findIndex((list) => list.includes(w));
    if (n >= 0 && n < count) return n;
    if (w.startsWith('лев') || w === 'налево') return 0;
    if (w.startsWith('прав') || w === 'направо') return count - 1;
  }
  return -1;
}
