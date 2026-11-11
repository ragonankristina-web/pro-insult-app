import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { TabScreen, Topline } from './Shell';
import { Grad, Notice } from './ui';
import { useAuth } from '../lib/Auth';
import { sessionsOn, shortName, useClinic, type Session } from '../lib/clinic';
import { addDays, hm, monthCells, months, monthsOf, sameDay, today, weekdays, weekHead } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

// Главная врача «Врач»: календарь всех занятий на месяц и что сегодня и завтра (по макету «врач вкладки»).
export function DoctorHome() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const clinic = useClinic();
  const now = today();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [picked, setPicked] = useState<Date | null>(null);
  const shift = (k: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + k) / 12), m: (m + k + 12) % 12 }));
  const cells = monthCells(view.y, view.m);
  const inMonth = clinic.sessions.filter((s) => s.at.getFullYear() === view.y && s.at.getMonth() === view.m);
  const tomorrow = addDays(now, 1);
  const other = picked && !sameDay(picked, now) && !sameDay(picked, tomorrow) ? picked : null;

  return (
    <TabScreen
      header={
        <Topline name={profile?.full_name || 'Без имени'} sub={`Врач · пациентов: ${clinic.demo ? 'пример' : clinic.patients.length}`} />
      }
    >
      {clinic.demo ? (
        <Notice tone="info">Расписание — пример. Свои занятия назначайте во вкладке «Занятия».</Notice>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Предыдущий месяц"
            hitSlop={6} style={[styles.iconBtn, { backgroundColor: c.pink2 }]}>
            <Icon name="back" color={c.pinkInk} size={20} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.month, { color: c.ink }]} accessibilityLiveRegion="polite">{`${months[view.m]} ${view.y}`}</Text>
            <Text style={[styles.monthSub, { color: c.inkMute }]}>{`занятий в месяце: ${inMonth.length}`}</Text>
          </View>
          <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Следующий месяц"
            hitSlop={6} style={[styles.iconBtn, { backgroundColor: c.pink2 }]}>
            <Icon name="next" color={c.pinkInk} size={20} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {weekHead.map((h) => (
            <Text key={h} style={[styles.head, { color: c.inkMute }]}>{h}</Text>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={styles.cell} />;
            const list = sessionsOn(inMonth, d);
            const isToday = sameDay(d, now);
            const on = picked ? sameDay(d, picked) : isToday;
            return (
              <Pressable
                key={i}
                onPress={() => setPicked(d)}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()} ${monthsOf[d.getMonth()]}, занятий: ${list.length}`}
                accessibilityState={{ selected: on }}
                style={styles.cell}
              >
                {isToday ? (
                  <Grad style={[styles.day, on && { borderColor: c.ink }]}>
                    <Text style={[styles.num, { color: c.onGrad }]}>{d.getDate()}</Text>
                    <Dots n={list.length} color="#fff" />
                  </Grad>
                ) : (
                  <View style={[styles.day, { backgroundColor: list.length ? c.pink2 : 'transparent' }, on && { borderColor: c.ink }]}>
                    <Text style={[styles.num, { color: list.length ? c.ink : c.inkMute }]}>{d.getDate()}</Text>
                    <Dots n={list.length} color={c.magenta} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {other ? <DayCard title={`${other.getDate()} ${monthsOf[other.getMonth()]}, ${weekdays[other.getDay()]}`} list={sessionsOn(clinic.sessions, other)} wide /> : null}
      <View style={styles.pair}>
        <DayCard title="Сегодня" list={sessionsOn(clinic.sessions, now)} />
        <DayCard title="Завтра" list={sessionsOn(clinic.sessions, tomorrow)} />
      </View>
    </TabScreen>
  );
}

function Dots({ n, color }: { n: number; color: string }) {
  if (!n) return null;
  return (
    <View style={styles.dots}>
      {Array.from({ length: Math.min(n, 4) }, (_, i) => (
        <View key={i} style={[styles.dotSm, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function DayCard({ title, list, wide }: { title: string; list: Session[]; wide?: boolean }) {
  const { c } = useTheme();
  const clinic = useClinic();
  const who = (s: Session) =>
    s.kind === 'group'
      ? `${s.patientIds.length} чел.`
      : shortName(clinic.patient(s.patientIds[0])?.name ?? '');
  const open = (s: Session) =>
    s.kind === 'individual'
      ? router.push({ pathname: '/patient/[id]', params: { id: s.patientIds[0] } })
      : router.push('/lessons');
  return (
    <View style={[styles.dayCard, wide ? null : { flex: 1 }, { backgroundColor: c.pink }]}>
      <Text style={[styles.dayTitle, { color: c.ink }]}>{title}</Text>
      {list.length ? (
        list.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => open(s)}
            accessibilityRole="button"
            accessibilityLabel={`${hm(s.at)}, ${s.title}, ${who(s)}`}
            style={({ pressed }) => [styles.item, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.bullet, { backgroundColor: c[s.metric] }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.itemTime, { color: c.magenta }]}>{`${hm(s.at)} · ${s.minutes} мин`}</Text>
              <Text style={[styles.itemTitle, { color: c.ink }]} numberOfLines={2}>{s.title}</Text>
              <Text style={[styles.itemWho, { color: c.inkMute }]} numberOfLines={1}>{who(s)}</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text style={[styles.empty, { color: c.pinkInk }]}>Занятий нет</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: radius.m, padding: 12, gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.head700, fontSize: 17 },
  monthSub: { fontFamily: fonts.body600, fontSize: 12, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  head: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.body700, fontSize: 11.5, paddingVertical: 5 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2.5 },
  day: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  num: { fontFamily: fonts.body700, fontSize: 14, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dotSm: { width: 4, height: 4, borderRadius: 2 },
  pair: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dayCard: { borderRadius: radius.m, padding: 11, gap: 7 },
  dayTitle: { fontFamily: fonts.head700, fontSize: 15, marginBottom: 1 },
  item: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 9 },
  bullet: { width: 8, borderRadius: 4 },
  itemTime: { fontFamily: fonts.body700, fontSize: 11.5 },
  itemTitle: { fontFamily: fonts.body700, fontSize: 12.5, lineHeight: 16, marginTop: 1 },
  itemWho: { fontFamily: fonts.body500, fontSize: 11.5, marginTop: 1 },
  empty: { fontFamily: fonts.body600, fontSize: 13 },
});
