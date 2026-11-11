// Демо-данные из макета — до тех пор, пока занятия, оценки и чат не хранятся в базе.

export type Metric = 'moto' | 'speech' | 'think';
export type Day = Record<Metric, number> & { done: number; date: Date };

export const metricName: Record<Metric, string> = { moto: 'моторика', speech: 'речь', think: 'мышление' };

// 8 недель оценок по видам реабилитации и сделанных занятий (из 3 в день); генератор с фиксированным зерном
// (у каждого пациента в кабинете врача — своё). Последний день — сегодня, поэтому даты настоящие.
export function makeDays(start = 4417): Day[] {
  let seed = start;
  const r = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const now = new Date();
  const out: Day[] = [];
  for (let i = 0; i < 56; i++) {
    const t = i / 55;
    const e = 1 - Math.pow(1 - t, 1.7);
    out.push({
      moto: Math.round(58 + 34 * e + (r() - 0.5) * 3.0),
      speech: Math.round(52 + 36 * t + (r() - 0.5) * 3.4),
      think: Math.round(61 + 28 * e + (r() - 0.5) * 3.0),
      done: r() < 0.76 ? 3 : r() < 0.6 ? 2 : 0,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - (55 - i)),
    });
  }
  out[out.length - 1].done = 2; // сегодня 2 из 3 — кольцо частичное
  return out;
}

export const days = makeDays();
export const perDay = 3;

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const dayByKey = new Map(days.map((d) => [dayKey(d.date), d]));

export type Lesson = { title: string; about: string; done: boolean };
export type LessonBlock = { metric: Metric; title: string; lessons: Lesson[]; foot: string };

export const lessonBlocks: LessonBlock[] = [
  {
    metric: 'think',
    title: 'Мышление',
    lessons: [
      { title: 'Поиск отличий, уровень 3', about: '8 минут · фиксируется время ответа', done: false },
      { title: 'Запоминание последовательностей', about: '6 минут · 3 подхода', done: false },
    ],
    foot: '~14 мин',
  },
  {
    metric: 'moto',
    title: 'Моторика',
    lessons: [
      { title: 'Сгибание и разгибание в локте', about: '3 подхода × 12 · камера считает повторы', done: true },
      { title: 'Удержание предмета в кисти', about: '4 подхода × 30 секунд', done: true },
    ],
    foot: 'техника 91%',
  },
  {
    metric: 'speech',
    title: 'Речь',
    lessons: [
      { title: 'Автоматизированные ряды', about: '10 минут · с голосовым сопровождением', done: false },
      { title: 'Называние предметов по картинкам', about: '5 минут · 20 карточек', done: false },
    ],
    foot: '~15 мин',
  },
];

// voice — надиктовано через Брэйни; at — время, мс; read — собеседник прочитал (для своих сообщений);
// video — видеокружок: path в хранилище (настоящий чат) или url на устройстве (пример переписки).
export type Message = {
  mine: boolean;
  text: string;
  voice?: boolean;
  at?: number;
  read?: boolean;
  video?: { path?: string; url?: string; seconds: number };
};

export const demoChat: Message[] = [
  { mine: false, text: 'Доброе утро! Вчера техника 91% — лучший результат за неделю. Продолжаем.' },
  { mine: true, text: 'Спасибо. К вечеру рука устаёт сильнее обычного.' },
  { mine: false, text: 'Тогда переносим моторику на утро, а речь оставим на вечер. Поменяла в плане.' },
];

// Переписки врача с пациентами (mine — сообщение врача); ago — сколько минут назад.
const ago = (min: number) => Date.now() - min * 60_000;
export const doctorThreads: Message[][] = [
  [
    { mine: true, text: 'Доброе утро! Вчера техника 91% — лучший результат за неделю. Продолжаем.', at: ago(26 * 60) },
    { mine: false, text: 'Спасибо. К вечеру рука устаёт сильнее обычного.', at: ago(25 * 60) },
    { mine: true, text: 'Тогда переносим моторику на утро, а речь оставим на вечер. Поменяла в плане.', at: ago(24 * 60) },
    { mine: false, text: 'Хорошо. Сегодня сделал утром, рука меньше устала.', at: ago(38) },
  ],
  [
    { mine: false, text: 'Здравствуйте! Не получается упражнение с языком, он уходит в сторону.', at: ago(3 * 60) },
    { mine: true, text: 'Это нормально на этом этапе. Делайте перед зеркалом, медленно, 5 повторов вместо 8.', at: ago(2 * 60 + 40) },
    { mine: false, text: 'Попробую, спасибо!', at: ago(2 * 60 + 35) },
  ],
  [
    { mine: true, text: 'Как самочувствие после группового занятия?', at: ago(2 * 24 * 60) },
    { mine: false, text: 'Устал, но понравилось. Можно чаще в группу?', at: ago(2 * 24 * 60 - 30) },
  ],
  [
    { mine: false, text: 'Давление утром 150 на 90. Заниматься сегодня?', at: ago(95) },
  ],
  [
    { mine: true, text: 'Отличная неделя — ни одного пропуска. Так держать!', at: ago(4 * 24 * 60) },
    { mine: false, text: 'Спасибо, доктор 🙂', at: ago(4 * 24 * 60 - 10) },
  ],
];

export const lastScores: { metric: Metric; title: string; date: string; value: number }[] = [
  { metric: 'moto', title: 'Моторика', date: '27 октября', value: 91 },
  { metric: 'speech', title: 'Речь', date: '26 октября', value: 78 },
  { metric: 'think', title: 'Мышление', date: '25 октября', value: 84 },
];

export const scoreParts: { title: string; value: string; share: number }[] = [
  { title: 'Полнота выполнения', value: '12 из 12', share: 1 },
  { title: 'Техника по камере', value: '91%', share: 0.91 },
  { title: 'Амплитуда движения', value: '96°', share: 0.8 },
  { title: 'Темп', value: 'в норме', share: 0.72 },
];

export const features = [
  { icon: '🎥', title: 'Контроль техники по камере', about: 'считает повторы и подсказывает, если движение неверное' },
  { icon: '🎙', title: 'Голосовой ассистент', about: 'управление голосом и дневник без рук' },
  { icon: '📈', title: 'Расширенная аналитика', about: 'подробные показатели и выгрузка для врача' },
];

export const doctors = [
  { initials: 'ИС', name: 'Ирина Соколова', about: 'невролог · ведёт вас' },
  { initials: 'МК', name: 'Марина Князева', about: 'реабилитолог' },
  { initials: 'ПР', name: 'Павел Рогов', about: 'логопед-афазиолог' },
];

export const partners = [
  { icon: '🏥', title: 'КубГМУ', about: 'научное сопровождение программы реабилитации', kind: 'партнёр' },
  { icon: '🦾', title: 'Тренажёры для кисти', about: 'подбор по вашей программе, доставка', kind: 'реклама' },
];

// Кабинет врача: кошелёк (пример) и платные функции для работы.
export const wallet = {
  balance: '12 400 ₽',
  plan: 'Врач',
  operations: [
    { title: 'Консультация — Смирнов А. П.', date: 'сегодня', sum: 1500 },
    { title: 'Групповое занятие «Артикуляция»', date: 'вчера', sum: 4000 },
    { title: 'Консультация — Орлова Г. И.', date: '3 дня назад', sum: 1500 },
    { title: 'Тариф «Врач», месяц', date: '1-е число', sum: -990 },
  ],
};

export const doctorFeatures = [
  { icon: '📊', title: 'Расширенная аналитика', about: 'сравнение пациентов, отчёты для КубГМУ и выгрузка в PDF' },
  { icon: '👥', title: 'Большие группы', about: 'групповые занятия до 20 пациентов' },
  { icon: '🎥', title: 'Видеоконсультации', about: 'звонок пациенту прямо из чата' },
];
