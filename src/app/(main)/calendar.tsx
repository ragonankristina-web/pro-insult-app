import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { BackHeader } from '../../components/Shell';
import { Grad } from '../../components/ui';
import { dayByKey, dayKey, days, metricName, perDay, type Day, type Metric } from '../../lib/demo';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь',
  'Ноябрь', 'Декабрь'];
const monthsOf = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября',
  'ноября', 'декабря'];
const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const head = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const metrics: Metric[] = ['moto', 'speech', 'think'];

const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const start = days[0].date;

// Клетки месяца: пустые до первого числа (неделя с понедельника), затем все дни месяца.
function monthCells(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

// Календарь занятий: по месяцам, цвет дня — сколько занятий сделано; по нажатию — подробности дня.
export default function Calendar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const now = today();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [picked, setPicked] = useState<Date>(now);

  const shift = (k: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + k) / 12), m: (m + k + 12) % 12 }));
  const isCurrent = view.y === now.getFullYear() && view.m === now.getMonth();
  const cells = monthCells(view.y, view.m);
  const inMonth = days.filter((d) => d.date.getFullYear() === view.y && d.date.getMonth() === view.m);
  const done = inMonth.reduce((a, d) => a + d.done, 0);
  const full = inMonth.filter((d) => d.done === perDay).length;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Календарь занятий" />

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Предыдущий месяц"
              hitSlop={6} style={[styles.iconBtn, { backgroundColor: c.pink2 }]}>
              <Icon name="back" color={c.pinkInk} size={20} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.month, { color: c.ink }]} accessibilityLiveRegion="polite">
                {`${months[view.m]} ${view.y}`}
              </Text>
              {!isCurrent ? (
                <Pressable
                  onPress={() => {
                    setView({ y: now.getFullYear(), m: now.getMonth() });
                    setPicked(now);
                  }}
                  accessibilityRole="button"
                  hitSlop={6}
                >
                  <Text style={[styles.todayLink, { color: c.magenta }]}>к сегодняшнему дню</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Следующий месяц"
              hitSlop={6} style={[styles.iconBtn, { backgroundColor: c.pink2 }]}>
              <Icon name="next" color={c.pinkInk} size={20} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {head.map((h) => (
              <Text key={h} style={[styles.head, { color: c.inkMute }]}>{h}</Text>
            ))}
            {cells.map((d, i) =>
              d ? (
                <DayCell key={i} date={d} day={dayByKey.get(dayKey(d))} now={now}
                  picked={dayKey(d) === dayKey(picked)} onPress={() => setPicked(d)} />
              ) : (
                <View key={i} style={styles.cell} />
              ),
            )}
          </View>

          <View style={styles.legend}>
            <Legend label="все 3"><Grad style={styles.sw} /></Legend>
            <Legend label="1–2"><View style={[styles.sw, { backgroundColor: c.pink }]} /></Legend>
            <Legend label="пропуск"><View style={[styles.sw, styles.swMiss, { borderColor: c.magenta }]} /></Legend>
          </View>
        </View>

        <DayDetails date={picked} day={dayByKey.get(dayKey(picked))} now={now} />

        <View style={[styles.sum, { backgroundColor: c.pink }]}>
          <Text style={[styles.sumTitle, { color: c.ink }]}>{`За ${months[view.m].toLowerCase()}`}</Text>
          {inMonth.length ? (
            <View style={styles.sumRow}>
              <Stat value={`${done}`} label={`занятий из ${inMonth.length * perDay}`} />
              <Stat value={`${full}`} label="дней без пропусков" />
              <Stat value={`${inMonth.filter((d) => !d.done).length}`} label="дней пропущено" />
            </View>
          ) : (
            <Text style={[styles.sumText, { color: c.inkSoft }]}>В этом месяце занятий нет.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function DayCell({ date, day, now, picked, onPress }: {
  date: Date; day?: Day; now: Date; picked: boolean; onPress: () => void;
}) {
  const { c } = useTheme();
  const isToday = date.getTime() === now.getTime();
  const future = date > now;
  const n = date.getDate();
  const state = !day ? (future ? 'день ещё не наступил' : 'занятий не было') : `выполнено ${day.done} из ${perDay}`;
  const label = `${n} ${monthsOf[date.getMonth()]}, ${state}${isToday ? ', сегодня' : ''}`;
  const ring = picked ? { borderColor: c.ink, borderWidth: 2 } : isToday ? { borderColor: c.magenta, borderWidth: 2 } : null;

  let body;
  if (day && day.done === perDay) {
    body = <Grad style={[styles.dot, ring]}><Text style={[styles.num, { color: c.onGrad }]}>{n}</Text></Grad>;
  } else if (day && day.done > 0) {
    body = <View style={[styles.dot, { backgroundColor: c.pink }, ring]}><Text style={[styles.num, { color: c.pinkInk }]}>{n}</Text></View>;
  } else if (day) {
    body = (
      <View style={[styles.dot, styles.swMiss, { borderColor: c.magenta }, ring]}>
        <Text style={[styles.num, { color: c.ink }]}>{n}</Text>
      </View>
    );
  } else {
    body = (
      <View style={[styles.dot, ring]}>
        <Text style={[styles.num, { color: future ? c.inkMute : c.inkSoft, opacity: future ? 0.7 : 1 }]}>{n}</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected: picked }} style={styles.cell}>
      {body}
    </Pressable>
  );
}

function DayDetails({ date, day, now }: { date: Date; day?: Day; now: Date }) {
  const { c } = useTheme();
  const title = `${date.getDate()} ${monthsOf[date.getMonth()]}, ${weekdays[date.getDay()]}`;
  const text = day
    ? day.done
      ? `Выполнено ${day.done} из ${perDay} занятий`
      : 'Занятия пропущены'
    : date > now
      ? 'День ещё не наступил'
      : date < start
        ? 'Реабилитация в приложении ещё не началась'
        : 'Нет данных';
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.dTitle, { color: c.ink }]}>
        {title}
        {date.getTime() === now.getTime() ? <Text style={{ color: c.magenta }}> · сегодня</Text> : null}
      </Text>
      <Text style={[styles.dText, { color: c.inkSoft }]}>{text}</Text>
      {day && day.done ? (
        <View style={styles.scores}>
          {metrics.map((m) => (
            <View key={m} style={[styles.score, { backgroundColor: c[m] }]}>
              <Text style={[styles.scoreVal, { color: c.ink }]}>{day[m]}</Text>
              <Text style={[styles.scoreName, { color: c.inkSoft }]}>{metricName[m]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Legend({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.legendItem}>
      {children}
      <Text style={[styles.legendText, { color: c.inkMute }]}>{label}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statVal, { color: c.heroNum }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1.5, borderRadius: radius.m, padding: 14, gap: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  month: { fontFamily: fonts.head700, fontSize: 18 },
  todayLink: { fontFamily: fonts.body700, fontSize: 12.5, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  head: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.body700, fontSize: 12, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  dot: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
    borderColor: 'transparent' },
  num: { fontFamily: fonts.body700, fontSize: 15, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body600, fontSize: 12 },
  sw: { width: 16, height: 16, borderRadius: 5 },
  swMiss: { borderWidth: 2, borderStyle: 'dashed' },
  dTitle: { fontFamily: fonts.head700, fontSize: 16 },
  dText: { fontFamily: fonts.body500, fontSize: 14 },
  scores: { flexDirection: 'row', gap: 8 },
  score: { flex: 1, borderRadius: radius.s, paddingVertical: 10, alignItems: 'center' },
  scoreVal: { fontFamily: fonts.head700, fontSize: 20, fontVariant: ['tabular-nums'] },
  scoreName: { fontFamily: fonts.body600, fontSize: 11.5, marginTop: 2 },
  sum: { borderRadius: radius.m, padding: 16, gap: 10 },
  sumTitle: { fontFamily: fonts.head700, fontSize: 16 },
  sumText: { fontFamily: fonts.body500, fontSize: 14 },
  sumRow: { flexDirection: 'row', gap: 10 },
  statVal: { fontFamily: fonts.head700, fontSize: 24, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fonts.body500, fontSize: 12, lineHeight: 16 },
});
