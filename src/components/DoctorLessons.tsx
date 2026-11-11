import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { PageHeader, Sect, TabScreen } from './Shell';
import { Button, Grad } from './ui';
import { groups, shortName, useClinic, type Session } from '../lib/clinic';
import { hm, monthsOf, today, weekHead } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

// Вкладка врача «Занятия»: групповые и индивидуальные занятия, назначение новых и вход в библиотеку упражнений.
export function DoctorLessons() {
  const { c } = useTheme();
  const clinic = useClinic();
  const t = today();
  const upcoming = clinic.sessions.filter((s) => s.at >= t);
  const nextGroup = (title: string) => upcoming.find((s) => s.kind === 'group' && s.title === `Группа «${title}»`);
  const individual = upcoming.filter((s) => s.kind === 'individual').slice(0, 6);
  // Новые групповые занятия, назначенные врачом, — сверх постоянных групп.
  const ownGroups = upcoming.filter((s) => s.kind === 'group' && s.id.startsWith('n'));

  return (
    <TabScreen header={<PageHeader title="Занятия" />}>
      <Pressable
        onPress={() => router.push('/library')}
        accessibilityRole="button"
        accessibilityLabel="Открыть библиотеку упражнений"
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <Grad style={styles.lib}>
          <View style={styles.libIcon}><Icon name="book" color="#fff" size={26} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.libTitle}>Библиотека упражнений</Text>
            <Text style={styles.libText}>Все упражнения: моторика, речь, мышление — посмотреть и назначить</Text>
          </View>
          <Text style={styles.libGo}>→</Text>
        </Grad>
      </Pressable>

      <Sect>Групповые занятия</Sect>
      <Text style={[styles.lead, { color: c.inkSoft }]}>
        Одно занятие для нескольких пациентов по общей программе — по расписанию группы.
      </Text>
      {groups.map((g) => {
        const next = nextGroup(g.title);
        return (
          <View key={g.title} style={[styles.card, { backgroundColor: c[g.metric] }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, { color: c.ink }]}>{g.title}</Text>
              <View style={[styles.pill, { backgroundColor: c.surface }]}>
                <Icon name="people" color={c.pinkInk} size={15} />
                <Text style={[styles.pillText, { color: c.pinkInk }]}>{next?.patientIds.length ?? 0}</Text>
              </View>
            </View>
            <Text style={[styles.cardText, { color: c.inkSoft }]}>
              {`${g.days.map((d) => weekHead[(d + 6) % 7]).join(', ')} · ${g.hour}:00 · ${g.minutes} мин`}
            </Text>
            {next ? <Text style={[styles.next, { color: c.ink }]}>{`Ближайшее: ${when(next)}`}</Text> : null}
          </View>
        );
      })}
      {ownGroups.map((s) => (
        <SessionRow key={s.id} s={s} who={`${s.patientIds.length} чел.`} />
      ))}
      <Button
        title="+ Новое групповое занятие"
        variant="soft"
        onPress={() => router.push({ pathname: '/session/new', params: { kind: 'group' } })}
      />

      <Sect>Индивидуальные занятия</Sect>
      <Text style={[styles.lead, { color: c.inkSoft }]}>
        Занятие с одним пациентом по его программе. Ближайшие:
      </Text>
      <View style={{ gap: 8 }}>
        {individual.map((s) => (
          <SessionRow key={s.id} s={s} who={shortName(clinic.patient(s.patientIds[0])?.name ?? '')} />
        ))}
      </View>
      <Button
        title="+ Новое индивидуальное занятие"
        variant="soft"
        onPress={() => router.push({ pathname: '/session/new', params: { kind: 'individual' } })}
      />
    </TabScreen>
  );
}

const when = (s: Session) => `${s.at.getDate()} ${monthsOf[s.at.getMonth()]}, ${hm(s.at)}`;

function SessionRow({ s, who }: { s: Session; who: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() =>
        s.kind === 'individual' ? router.push({ pathname: '/patient/[id]', params: { id: s.patientIds[0] } }) : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={`${when(s)}, ${s.title}, ${who}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.bar, { backgroundColor: c[s.metric] }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTime, { color: c.magenta }]}>{`${when(s)} · ${s.minutes} мин`}</Text>
        <Text style={[styles.rowTitle, { color: c.ink }]}>{s.title}</Text>
        <Text style={[styles.rowWho, { color: c.inkMute }]}>{who}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lib: { borderRadius: radius.m, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  libIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center',
    justifyContent: 'center' },
  libTitle: { color: '#fff', fontFamily: fonts.head700, fontSize: 18 },
  libText: { color: '#fff', opacity: 0.9, fontFamily: fonts.body500, fontSize: 13, lineHeight: 18, marginTop: 2 },
  libGo: { color: '#fff', fontFamily: fonts.body700, fontSize: 22 },
  lead: { fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 19, marginTop: -6 },
  card: { borderRadius: radius.m, padding: 14, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, fontFamily: fonts.head700, fontSize: 16 },
  cardText: { fontFamily: fonts.body600, fontSize: 13 },
  next: { fontFamily: fonts.body700, fontSize: 13, marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.body700, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, borderWidth: 1.5, borderRadius: radius.s, padding: 11 },
  bar: { width: 6, borderRadius: 3 },
  rowTime: { fontFamily: fonts.body700, fontSize: 12 },
  rowTitle: { fontFamily: fonts.body700, fontSize: 14, marginTop: 1 },
  rowWho: { fontFamily: fonts.body500, fontSize: 12.5, marginTop: 1 },
});
