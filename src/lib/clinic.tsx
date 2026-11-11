import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { addDays, today } from './dates';
import { makeDays, type Day, type Metric } from './demo';
import { usePeople } from './people';

// Кабинет врача: его пациенты и расписание занятий (групповых и индивидуальных).
// Пациенты — по подтверждённым связям; пока их нет, показываем пример из демо-данных.
// Расписание пока демонстрационное и живёт в памяти; новые занятия врача добавляются к нему.

export type Patient = { id: string; name: string; number: string; demo: boolean; seed: number; week: number };

export type Session = {
  id: string;
  at: Date;
  minutes: number;
  kind: 'individual' | 'group';
  metric: Metric;
  title: string;
  patientIds: string[];
};

const demoPeople = [
  ['Алексей Петрович Смирнов', '#пац-4821'],
  ['Галина Ивановна Орлова', '#пац-3307'],
  ['Сергей Николаевич Кузнецов', '#пац-5190'],
  ['Валентина Петровна Белова', '#пац-2764'],
  ['Николай Андреевич Фёдоров', '#пац-6038'],
  ['Людмила Викторовна Зайцева', '#пац-1452'],
];

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0x7fffffff, 7);

export const groups: { metric: Metric; title: string; days: number[]; hour: number; minutes: number }[] = [
  { metric: 'moto', title: 'Моторика кисти', days: [1, 3, 5], hour: 10, minutes: 45 },
  { metric: 'speech', title: 'Артикуляция', days: [2, 4], hour: 11, minutes: 40 },
  { metric: 'think', title: 'Память и внимание', days: [5], hour: 15, minutes: 40 },
];

const individualTitle: Record<Metric, string> = {
  moto: 'Моторика — индивидуально',
  speech: 'Речь — индивидуально',
  think: 'Мышление — индивидуально',
};
const metrics: Metric[] = ['moto', 'speech', 'think'];

// Расписание с начала прошлого месяца до конца следующего: группы по своим дням недели,
// у каждого пациента два индивидуальных занятия в неделю.
function makeSchedule(patients: Patient[]): Session[] {
  const t = today();
  const from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const to = new Date(t.getFullYear(), t.getMonth() + 2, 0);
  const out: Session[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    groups.forEach((g, gi) => {
      if (!g.days.includes(wd)) return;
      out.push({
        id: `g${gi}-${d.getTime()}`,
        at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), g.hour),
        minutes: g.minutes,
        kind: 'group',
        metric: g.metric,
        title: `Группа «${g.title}»`,
        patientIds: patients.filter((_, i) => i % groups.length !== gi).map((p) => p.id),
      });
    });
    patients.forEach((p, i) => {
      if (wd !== 1 + (i % 5) && wd !== 1 + ((i + 2) % 5)) return;
      const metric = metrics[(i + wd) % 3];
      out.push({
        id: `i${p.id}-${d.getTime()}`,
        at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13 + (i % 4), i % 2 ? 30 : 0),
        minutes: 30,
        kind: 'individual',
        metric,
        title: individualTitle[metric],
        patientIds: [p.id],
      });
    });
  }
  return out;
}

type Clinic = {
  patients: Patient[];
  loading: boolean;
  demo: boolean; // пациенты — пример, своих пока нет
  sessions: Session[];
  addSession: (s: Omit<Session, 'id'>) => void;
  patient: (id: string) => Patient | undefined;
};

const ClinicContext = createContext<Clinic>({
  patients: [], loading: false, demo: true, sessions: [], addSession: () => {}, patient: () => undefined,
});
export const useClinic = () => useContext(ClinicContext);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const people = usePeople();
  // Связи приходят новым массивом на каждой отрисовке — пересчитываем, только когда изменились сами люди.
  // Пока в базе не выполнен chat.sql, id профиля не приходит — тогда переписка с пациентом остаётся примером.
  const raw = JSON.stringify(people.patients.map((l) => [l.other_id ?? `l${l.id}`, l.other_name, l.other_number]));
  const patients = useMemo<Patient[]>(() => {
    const real = JSON.parse(raw) as [string, string, string][];
    // У настоящего пациента id — id его профиля: по нему же идёт переписка в чате.
    const list = real.length
      ? real.map(([id, name, number]) => ({ id, name: name || 'Без имени', number, demo: false }))
      : demoPeople.map(([name, number], i) => ({ id: `d${i}`, name, number, demo: true }));
    return list.map((p) => ({ ...p, seed: hash(p.id + p.number), week: 2 + (hash(p.id) % 9) }));
  }, [raw]);
  const base = useMemo(() => makeSchedule(patients), [patients]);
  const [extra, setExtra] = useState<Session[]>([]);
  const sessions = useMemo(() => [...base, ...extra].sort((a, b) => a.at.getTime() - b.at.getTime()), [base, extra]);
  const addSession = useCallback((s: Omit<Session, 'id'>) => setExtra((x) => [...x, { ...s, id: `n${Date.now()}` }]), []);
  const patient = useCallback((id: string) => patients.find((p) => p.id === id), [patients]);
  return (
    <ClinicContext.Provider
      value={{ patients, loading: people.loading, demo: !patients.length || patients[0].demo, sessions, addSession, patient }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

// Показатели пациента — свои демо-данные на каждого (пока оценки не хранятся в базе).
const daysCache = new Map<number, Day[]>();
export function patientDays(p: Patient) {
  if (!daysCache.has(p.seed)) daysCache.set(p.seed, makeDays(p.seed || 1));
  return daysCache.get(p.seed)!;
}

export const sessionsOn = (sessions: Session[], day: Date) =>
  sessions.filter(
    (s) => s.at.getFullYear() === day.getFullYear() && s.at.getMonth() === day.getMonth() && s.at.getDate() === day.getDate(),
  );

// «Алексей Петрович Смирнов» → «Смирнов А. П.» — для коротких списков.
export function shortName(name: string) {
  const w = name.trim().split(/\s+/);
  if (w.length < 3) return name;
  return `${w[2]} ${w[0][0]}. ${w[1][0]}.`;
}

// Сводка по пациенту для плиток и карточки: занятия за неделю и рост оценок с начала.
export function summary(p: Patient) {
  const d = patientDays(p);
  const week = d.slice(-7);
  const avg = (x: Day) => (x.moto + x.speech + x.think) / 3;
  return {
    days: d,
    weekDone: week.reduce((a, x) => a + x.done, 0),
    growth: Math.round(avg(d[d.length - 1]) - avg(d[0])),
  };
}
