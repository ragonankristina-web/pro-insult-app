import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressLine, Ring, WeekBars } from '../../../components/Charts';
import { BackHeader, Sect } from '../../../components/Shell';
import { Button, Notice } from '../../../components/ui';
import { summary, useClinic } from '../../../lib/clinic';
import { hm, monthsOf, today } from '../../../lib/dates';
import { metricName, perDay, type Metric } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

const metrics: Metric[] = ['moto', 'speech', 'think'];
const segLabel: Record<Metric, string> = { moto: 'Моторика', speech: 'Речь', think: 'Мышление' };

// Карточка пациента для врача: выполнение занятий и динамика оценок по видам реабилитации.
export default function PatientCard() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clinic = useClinic();
  const p = clinic.patient(id);
  const [metric, setMetric] = useState<Metric>('moto');

  if (!p) {
    return (
      <View style={[styles.root, { flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 10 }]}>
        <View style={styles.inner}>
          <BackHeader title="Пациент" />
          <Notice tone="info">Пациент не найден — возможно, связь с ним удалена.</Notice>
        </View>
      </View>
    );
  }

  const s = summary(p);
  const last = s.days[s.days.length - 1];
  const first = s.days[0];
  const t = today();
  const upcoming = clinic.sessions.filter((x) => x.patientIds.includes(p.id) && x.at >= t).slice(0, 4);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}
    >
      <View style={styles.inner}>
        <BackHeader title={p.name} />
        <Text style={[styles.sub, { color: c.inkMute }]}>
          {`${p.number} · ${p.week}-я неделя реабилитации${p.demo ? ' · пример данных' : ''}`}
        </Text>

        <View style={[styles.hero, { backgroundColor: c.pink }]}>
          <Ring share={last.done / perDay} caption={'выполнено\nсегодня'} />
          <View style={{ flex: 1, gap: 8 }}>
            <Big value={`${s.weekDone} из ${perDay * 7}`} label="занятий за неделю" />
            <Big value={`${s.growth >= 0 ? '+' : ''}${s.growth}`} label="рост средней оценки с начала" />
          </View>
        </View>

        <Sect>Оценки сейчас</Sect>
        <View style={styles.tiles}>
          {metrics.map((m) => (
            <View key={m} style={[styles.tile, { backgroundColor: c[m] }]}>
              <Text style={[styles.tileVal, { color: c.ink }]}>{last[m]}</Text>
              <Text style={[styles.tileName, { color: c.inkSoft }]}>{metricName[m]}</Text>
              <Text style={[styles.tileDiff, { color: c.ok }]}>{`${last[m] - first[m] >= 0 ? '+' : ''}${last[m] - first[m]} с начала`}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.cardTitle, { color: c.ink }]}>Прогресс за 8 недель</Text>
          <View style={styles.segs}>
            {metrics.map((m) => {
              const on = m === metric;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMetric(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.seg, { backgroundColor: on ? c.magenta : c.pink2 }]}
                >
                  <Text style={[styles.segText, { color: on ? c.onGrad : c.pinkInk }]}>{segLabel[m]}</Text>
                </Pressable>
              );
            })}
          </View>
          <ProgressLine data={s.days} metric={metric} />
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.cardTitle, { color: c.ink }]}>Занятия за неделю</Text>
          <WeekBars week={s.days.slice(-7)} perDay={perDay} />
        </View>

        <Sect>Ближайшие занятия</Sect>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line, gap: 8 }]}>
          {upcoming.length ? (
            upcoming.map((x) => (
              <View key={x.id} style={styles.sess}>
                <View style={[styles.dot, { backgroundColor: c[x.metric] }]} />
                <Text style={[styles.sessText, { color: c.ink }]}>
                  {`${x.at.getDate()} ${monthsOf[x.at.getMonth()]}, ${hm(x.at)} — ${x.title}`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.sessText, { color: c.inkMute }]}>Занятий не назначено.</Text>
          )}
        </View>

        <View style={styles.row}>
          <Button title="Написать" onPress={() => router.push({ pathname: '/chat', params: { with: p.id } })} style={{ flex: 1 }} />
          <Button
            title="Назначить занятие"
            variant="soft"
            onPress={() => router.push({ pathname: '/session/new', params: { kind: 'individual', patient: p.id } })}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View>
      <Text style={[styles.bigVal, { color: c.heroNum }]}>{value}</Text>
      <Text style={[styles.bigLabel, { color: c.pinkInk }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  sub: { fontFamily: fonts.body600, fontSize: 13, marginTop: -8 },
  hero: { borderRadius: radius.m, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigVal: { fontFamily: fonts.head700, fontSize: 24, fontVariant: ['tabular-nums'] },
  bigLabel: { fontFamily: fonts.body600, fontSize: 12.5 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: radius.s, paddingVertical: 12, alignItems: 'center' },
  tileVal: { fontFamily: fonts.head700, fontSize: 24, fontVariant: ['tabular-nums'] },
  tileName: { fontFamily: fonts.body600, fontSize: 12 },
  tileDiff: { fontFamily: fonts.body700, fontSize: 11.5, marginTop: 3 },
  card: { borderWidth: 1.5, borderRadius: radius.m, padding: 14, gap: 10 },
  cardTitle: { fontFamily: fonts.head700, fontSize: 15 },
  segs: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.body700, fontSize: 12.5 },
  sess: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sessText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10 },
});
