import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrainySpot } from '../../../components/BrainyStage';
import { ProgressLine, Ring, WeekBars } from '../../../components/Charts';
import { DoctorHome } from '../../../components/DoctorHome';
import { TabScreen, Topline } from '../../../components/Shell';
import { Button, Notice } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { react } from '../../../lib/brainyMood';
import { days, metricName, perDay, type Metric } from '../../../lib/demo';
import { usePeople } from '../../../lib/people';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

const segs: { m: Metric; label: string }[] = [
  { m: 'moto', label: 'Мот' },
  { m: 'speech', label: 'Речь' },
  { m: 'think', label: 'Мышл' },
];

const native = Platform.OS !== 'web';

// Главный: выполнение за сегодня (с Брэйни), кнопка занятия, графики прогресса и занятий за неделю.
// У врача — своя главная «Врач» (DoctorHome): календарь занятий, сегодня и завтра.
export default function Home() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const people = usePeople();
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.magenta} size="large" />
      </View>
    );
  }

  const role = profile.role;
  if (role === 'doctor') return <DoctorHome />;
  const patientName = people.patients[0]?.other_name;
  const sub = role === 'caregiver' ? `Помогаете: ${patientName ?? 'пациент не привязан'}` : '4-я неделя реабилитации';

  return (
    <TabScreen header={<Topline name={profile.full_name || 'Без имени'} sub={sub} />}>
      {role === 'caregiver' && !patientName && !people.loading ? (
        <Notice tone="info">Привяжите подопечного по его номеру (#пац-…) в профиле. Пока показан пример данных.</Notice>
      ) : null}

      <HeroCard share={days[days.length - 1].done / perDay} />
      <Button
        title={role === 'caregiver' ? 'Открыть занятия' : 'Начать занятие'}
        onPress={() => router.push('/lessons')}
        style={styles.cta}
      />

      <ChartsCard />
    </TabScreen>
  );
}

// Карточка «выполнено сегодня» занимает всё свободное место. Сначала в её центре стоит Брэйни;
// через пару секунд он отходит вправо, а на его месте появляется кольцо с процентами.
function HeroCard({ share }: { share: number }) {
  const { c } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [p] = useState(() => new Animated.Value(0)); // 0 — Брэйни в центре, 1 — справа, кольцо видно

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(2500),
      Animated.timing(p, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
    ]);
    anim.start(({ finished }) => {
      if (finished && share > 0) react('happy'); // показал проценты — радуется сделанному
    });
    return () => anim.stop();
  }, [p, share]);

  const half = box.w / 2;
  const ring = Math.max(120, Math.min(188, half - 10, box.h - 16));
  return (
    <View
      style={[styles.hero, { backgroundColor: c.pink }]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox((b) => (Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
      }}
    >
      {box.w ? (
        <>
          <Animated.View
            style={[styles.half, { opacity: p, transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
          >
            <Ring share={share} caption={'выполнено\nзаданий сегодня'} size={ring} />
          </Animated.View>
          {/* Правая половина; сначала сдвинута на четверть влево — Брэйни ровно в центре карточки. */}
          <Animated.View
            style={[styles.half, { transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-half / 2, 0] }) }] }]}
          >
            <BrainySpot style={StyleSheet.absoluteFill} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

function ChartsCard() {
  const { c } = useTheme();
  const [metric, setMetric] = useState<Metric>('moto');
  const week = days.slice(-7);
  const done = week.reduce((a, d) => a + d.done, 0);
  return (
    <View style={[styles.charts, { backgroundColor: c.pink }]}>
      <View style={[styles.box, { backgroundColor: c.surface }]}>
        <Pressable
          onPress={() => router.push({ pathname: '/chat', params: { sub: 'stats' } })}
          accessibilityRole="button"
          accessibilityLabel="Прогресс — открыть показатели"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={[styles.h4, { color: c.ink }]}>Прогресс →</Text>
          <Text style={[styles.boxSub, { color: c.inkMute }]}>{metricName[metric]} · за 8 недель</Text>
          <ProgressLine data={days} metric={metric} />
        </Pressable>
        <View style={styles.segs}>
          {segs.map((s) => {
            const on = s.m === metric;
            return (
              <Pressable
                key={s.m}
                onPress={() => setMetric(s.m)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={metricName[s.m]}
                style={[styles.seg, { backgroundColor: on ? c.magenta : c.pink2 }]}
              >
                <Text style={[styles.segText, { color: on ? c.onGrad : c.pinkInk }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        onPress={() => router.push('/calendar')}
        accessibilityRole="button"
        accessibilityLabel={`Занятия за неделю: ${done} из ${perDay * 7}. Открыть календарь`}
        style={({ pressed }) => [styles.box, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.h4, { color: c.ink }]}>Занятия →</Text>
        <Text style={[styles.boxSub, { color: c.inkMute }]}>сделанные за неделю</Text>
        <WeekBars week={week} perDay={perDay} />
        <Text style={[styles.bignum, { color: c.heroNum }]}>
          {done}
          <Text style={[styles.bigSmall, { color: c.inkMute }]}>{` из ${perDay * 7}`}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexGrow: 1, minHeight: 220, borderRadius: radius.m, paddingVertical: 10, flexDirection: 'row', overflow: 'hidden' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: 10 },
  charts: { borderRadius: radius.m, padding: 14, flexDirection: 'row', gap: 11 },
  box: { flex: 1, minWidth: 0, borderRadius: radius.s, paddingHorizontal: 10, paddingTop: 11, paddingBottom: 9 },
  h4: { fontFamily: fonts.head700, fontSize: 14 },
  boxSub: { fontFamily: fonts.body500, fontSize: 11.5, marginTop: 1, marginBottom: 6 },
  segs: { flexDirection: 'row', gap: 4, marginTop: 8 },
  seg: { flex: 1, minHeight: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.body700, fontSize: 11.5 },
  bignum: { fontFamily: fonts.head700, fontSize: 22, marginTop: 9, fontVariant: ['tabular-nums'] },
  bigSmall: { fontFamily: fonts.body600, fontSize: 12 },
});
