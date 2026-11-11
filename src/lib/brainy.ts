// «Мозг» ассистента Брэйни: разбирает фразу пациента в команду. Работает без интернета и без платного ИИ —
// по словарю ключевых слов. Ничего не придумывает о лечении: технику берёт из карточек упражнений.

export type Target = { path: string; title: string };

export type Intent =
  | { kind: 'go'; to: Target }
  | { kind: 'back' }
  | { kind: 'explain'; id: string | null } // null — упражнение на текущем экране
  | { kind: 'write'; text: string } // пустой текст — спросить, что написать
  | { kind: 'remind'; at: Date; what: string }
  | { kind: 'remindAsk' }
  | { kind: 'today' }
  | { kind: 'help' }
  | { kind: 'stop' }
  | { kind: 'emergency'; write: string }
  | { kind: 'unknown' };

const norm = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\d:]+/gu, ' ').trim();

// ── обращение по имени ────────────────────────────────────
// Распознавание пишет имя по-разному: «Брэйни», «Брейни», «Брайни», «Брейн и», «brainy».
const wakeRe = /(?<!\p{L})(?:бр[эеаи]й?н(?:н?[иыеэ])?|brainy|brain)(?!\p{L})/u;

// Есть обращение — возвращает команду после имени (или перед ним: «открой речь, Брэйни»).
export function findWake(raw: string): { command: string } | null {
  const m = wakeRe.exec(raw.toLowerCase().replace(/ё/g, 'е'));
  if (!m) return null;
  const clean = (s: string) =>
    s.replace(/^[\s,.!?:;—-]+|[\s,.!?:;—-]+$/g, '').replace(/^(?:и|ну|пожалуйста)\s+/i, '').trim();
  const after = clean(raw.slice(m.index + m[0].length));
  return { command: after || clean(raw.slice(0, m.index)) };
}

// ── куда можно перейти ────────────────────────────────────
// Порядок важен: сначала конкретные упражнения, потом разделы.
const places: [RegExp, Target][] = [
  [/трубочк/, { path: '/speech/lips-tube', title: 'губы трубочкой' }],
  [/уголк|улыбк/, { path: '/speech/lips-corners', title: 'уголки губ' }],
  [/язык/, { path: '/speech/tongue-forward', title: 'язык вперёд' }],
  [/щек|воздух|перекат/, { path: '/speech/air-roll', title: 'перекатывание воздуха' }],
  [/фрукт|сад|корзин|игр/, { path: '/think/fruit', title: 'игру «Фруктовый сад»' }],
  [/захват|скелет|угл[ыа]? сустав/, { path: '/moto/capture', title: 'захват движений' }],
  [/библиотек/, { path: '/library', title: 'библиотеку упражнений' }],
  [/статистик|мои пациент|моих пациент/, { path: '/stats', title: 'ваших пациентов' }],
  [/кошел/, { path: '/shop', title: 'кошелёк' }],
  [/календар/, { path: '/calendar', title: 'календарь занятий' }],
  [/показател|прогресс|оценк|график|результат/, { path: '/chat?sub=stats', title: 'показатели' }],
  [/чат|переписк|сообщени|врач|доктор/, { path: '/chat', title: 'чат с врачом' }],
  [/реч|артикуляц/, { path: '/speech', title: 'упражнения для речи' }],
  [/мышлен|памят|внимани/, { path: '/think', title: 'упражнения для мышления' }],
  [/моторик|движени/, { path: '/moto', title: 'упражнения для моторики' }],
  [/заняти|упражнени|трениров/, { path: '/lessons', title: 'занятия на сегодня' }],
  [/главн|домой|начал/, { path: '/home', title: 'главный экран' }],
  [/покупк|магазин|товар/, { path: '/shop', title: 'покупки' }],
  [/профил|номер|настройк/, { path: '/profile', title: 'профиль' }],
];

const exerciseIds: [RegExp, string][] = [
  [/трубочк/, 'lips-tube'],
  [/уголк|улыбк/, 'lips-corners'],
  [/язык/, 'tongue-forward'],
  [/щек|воздух|перекат/, 'air-roll'],
  [/фрукт|сад|корзин|игр/, 'fruit'],
];

const find = <T>(list: [RegExp, T][], t: string) => list.find(([re]) => re.test(t))?.[1];

// ── разбор фразы ──────────────────────────────────────────
const writeRe =
  /^(?:пожалуйста\s+)?(?:(?:напиши|написать|отправь|отправить)(?:\s+(?:врачу|доктору|пациенту|в\s+чат))?|(?:скажи|передай|сообщи)\s+(?:врачу|доктору|пациенту))(?![\p{L}])/iu;
const emergencyRe =
  /перекосил|онемел|немеет|не могу говорить|не чувствую|скорую|скорая|мне плохо|очень плохо|сознание|сильно болит голова/;

export function parse(raw: string, now = new Date()): Intent {
  const t = norm(raw);
  const w = writeRe.exec(raw.trim());
  const write = w ? raw.trim().slice(w[0].length).replace(/^[\s,:—-]+/, '').replace(/^что\s+/i, '') : '';

  if (emergencyRe.test(t)) return { kind: 'emergency', write: w ? write : raw.trim() };
  if (/^(?:стоп|хватит|замолчи|тихо|отмена|закрой|закрыть|все|все спасибо|спасибо)$/.test(t)) return { kind: 'stop' };
  if (/напомни|напоминани/.test(t)) {
    const r = parseReminder(t, now);
    return r ? { kind: 'remind', ...r } : { kind: 'remindAsk' };
  }
  if (w) return { kind: 'write', text: write };
  if (/на сегодня|план|что дальше|что осталось|сколько осталось|что сегодня|какие заняти/.test(t)) return { kind: 'today' };
  if (/как (?:делать|сделать|выполнять|выполнить|играть|правильно)|объясни|техник|подскажи|расскажи|помоги (?:сделать|выполнить)|что делать|не получается/.test(t)) {
    return { kind: 'explain', id: find(exerciseIds, t) ?? null };
  }
  const to = find(places, t);
  if (to) return { kind: 'go', to };
  if (/^(?:назад|вернись|обратно)/.test(t)) return { kind: 'back' };
  if (/умеешь|помощь|помоги|что можно|команд/.test(t)) return { kind: 'help' };
  return { kind: 'unknown' };
}

// ── напоминания: «в 18:00», «в шесть вечера», «через 30 минут», «через час» ──
const numWords: Record<string, number> = {
  один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, пятнадцать: 15, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
  полтора: 1.5,
};
const num = (s: string | undefined): number | undefined =>
  s === undefined ? undefined : /^\d+$/.test(s) ? Number(s) : numWords[s];

function inTime(t: string, now: Date): Date | null {
  const m = /через\s+(?:(.+?)\s+)?(минут\S*|час\S*|полчаса)/.exec(t);
  if (!m) return null;
  let n = 1;
  if (m[1]) {
    const parts = m[1].split(' ').map(num);
    if (parts.some((p) => p === undefined)) return null;
    n = parts.reduce<number>((a, p) => a + p!, 0);
  }
  const minutes = m[2] === 'полчаса' ? 30 : m[2].startsWith('час') ? n * 60 : n;
  return new Date(now.getTime() + minutes * 60_000);
}

function atTime(t: string, now: Date): Date | null {
  const m = /(?:^|\s)в\s+(\S+)(.*)$/.exec(t);
  if (!m) return null;
  const [hs, ms] = m[1].split(':');
  let h = num(hs);
  if (h === undefined || h > 23 || !Number.isInteger(h)) return null;
  let min = ms ? Number(ms) : 0;
  const rest = m[2].trim().split(' ').filter(Boolean);
  let i = 0;
  if (rest[i]?.startsWith('час')) i++;
  // «в 18 30», «в шесть тридцать», «в семь пятнадцать минут»
  const mm = ms ? undefined : num(rest[i]);
  if (mm !== undefined && mm < 60) {
    min = mm;
    i++;
  }
  const part = rest.find((x) => /^(?:утра|дня|вечера|ночи)$/.test(x));
  if ((part === 'вечера' || part === 'дня') && h < 12) h += 12;
  if (part === 'ночи' && h === 12) h = 0;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
  if (at <= now && !part && h < 12) at.setHours(h + 12); // «в 6» днём — значит вечером
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

function reminderText(t: string) {
  if (/лекарств|таблетк/.test(t)) return 'принять лекарство';
  if (/давлени/.test(t)) return 'измерить давление';
  if (/вод|пить|попить/.test(t)) return 'выпить воды';
  if (/врач|доктор/.test(t)) return 'написать врачу';
  const rest = t
    .replace(/напомни\S*|напоминани\S*|(?<!\p{L})мне(?!\p{L})|пожалуйста/gu, ' ')
    .replace(/через\s+(?:.+?\s+)?(?:минут\S*|час\S*|полчаса)/, ' ')
    .replace(/(?:^|\s)в\s+\S+(?:\s+час\S*)?(?:\s+(?:утра|дня|вечера|ночи))?/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:про|о|об|что|чтобы|что бы)\s+/, '');
  return rest && !/заняти|упражнени/.test(rest) ? rest : 'пора заниматься';
}

export function parseReminder(t: string, now = new Date()): { at: Date; what: string } | null {
  const at = inTime(t, now) ?? atTime(t, now);
  return at ? { at, what: reminderText(t) } : null;
}

export function whenText(at: Date, now = new Date()) {
  const hm = `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return at >= tomorrow ? `завтра в ${hm}` : `сегодня в ${hm}`;
}

// ── надиктованное сообщение: «запятая», «точка» → знаки, заглавная буква, точка в конце ──
export function tidyMessage(raw: string) {
  const mark = (word: string, sign: string, s: string) =>
    s.replace(new RegExp(`\\s*(?<!\\p{L})${word}(?!\\p{L})`, 'giu'), sign);
  let s = raw;
  s = mark('вопросительный знак', '?', s);
  s = mark('восклицательный знак', '!', s);
  s = mark('запятая', ',', s);
  s = mark('точка', '.', s);
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  if (!s) return '';
  s = s.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  return /[.!?…)]$/.test(s) ? s : `${s}.`;
}

// Ответы на «да / нет» к черновику сообщения.
export const isYes = (t: string) => /^(?:да|отправ\S*|готово|верно|правильно)(?:\s|$)/.test(norm(t));
export const isNo = (t: string) => /^(?:нет|отмен\S*|не надо|не отправляй|стоп)(?:\s|$)/.test(norm(t));
export const isAgain = (t: string) => /^(?:заново|еще раз|сначала|по другому|переделай)(?:\s|$)/.test(norm(t));
