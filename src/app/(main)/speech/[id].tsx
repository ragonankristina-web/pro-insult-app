import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PatientCamera } from '../../../components/PatientCamera';
import { BackHeader } from '../../../components/Shell';
import { react } from '../../../lib/brainyMood';
import { Button, Notice } from '../../../components/ui';
import { speechExercises, type Exercise, type Verdict } from '../../../lib/exercises';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Цвет рамки вокруг пациента: серая — ждём движения, зелёная — верно, жёлтая — не до конца или неравномерно.
const frame: Record<Verdict['state'], string> = { idle: '#B9B4BC', ok: '#2FD27A', warn: '#FFC93C' };

// Экран упражнения: сверху пример выполнения, снизу камера пациента в рамке.
export default function ExerciseScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = speechExercises.find((e) => e.id === id);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}
    >
      <View style={styles.inner}>
        <BackHeader title={ex?.title ?? 'Упражнение'} />
        {ex ? <Body ex={ex} /> : <Notice tone="error">Упражнение не найдено.</Notice>}
      </View>
    </ScrollView>
  );
}

function Body({ ex }: { ex: Exercise }) {
  const { c } = useTheme();
  const player = useVideoPlayer(ex.video, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const [verdict, setVerdict] = useState<Verdict>({ state: 'idle', hint: 'Повторяйте за примером.' });
  const [reps, setReps] = useState(0);
  const prev = useRef<Verdict['state']>('idle');

  // Камера присылает оценку каждого кадра — обновляем экран только при смене состояния.
  // Повтор засчитывается, когда пациент вышел из верного положения (зелёная рамка погасла).
  const onVerdict = useCallback((v: Verdict) => {
    if (prev.current === 'ok' && v.state !== 'ok') {
      setReps((n) => n + 1);
      react('happy'); // Брэйни радуется каждому повтору
    }
    prev.current = v.state;
    setVerdict((old) => (old.state === v.state && old.hint === v.hint ? old : v));
  }, []);

  const finished = ex.judge && reps >= ex.reps;
  const done = () => (router.canGoBack() ? router.back() : router.replace('/speech' as never));
  const color = frame[verdict.state];

  return (
    <>
      <View style={[styles.card, { backgroundColor: c.pink }]}>
        <Text style={[styles.label, { color: c.pinkInk }]}>ПРИМЕР</Text>
        <VideoView player={player} style={styles.example} contentFit="contain" nativeControls={false} />
        {ex.steps.map((s, i) => (
          <Text key={s} style={[styles.step, { color: c.ink }]}>{`${i + 1}. ${s}`}</Text>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.line }]}>
        <View style={styles.camHead}>
          <Text style={[styles.label, { color: c.pinkInk }]}>ВЫ</Text>
          {ex.judge ? (
            <Text style={[styles.reps, { color: c.heroNum }]}>{`Повторы: ${Math.min(reps, ex.reps)} из ${ex.reps}`}</Text>
          ) : null}
        </View>
        <View style={styles.camera}>
          <PatientCamera judge={ex.judge} onVerdict={onVerdict} />
          <View pointerEvents="none" style={[styles.frame, { borderColor: color }]} />
          {ex.judge ? (
            <View pointerEvents="none" style={styles.hintWrap}>
              <View style={[styles.hint, { borderColor: color }]}>
                <Text style={styles.hintText} accessibilityLiveRegion="polite">{verdict.hint}</Text>
              </View>
            </View>
          ) : null}
        </View>
        {ex.judge ? (
          <View style={styles.legend}>
            <Legend color={frame.ok} label="верно" />
            <Legend color={frame.warn} label="не до конца" />
            <Legend color={frame.idle} label="ждём движения" />
          </View>
        ) : (
          <Text style={[styles.note, { color: c.inkMute }]}>
            Для этого упражнения автопроверки пока нет — выполняйте по примеру, глядя на себя в камере.
          </Text>
        )}
      </View>

      {finished ? <Notice tone="ok">{`Отлично! Все ${ex.reps} повторов выполнены.`}</Notice> : null}
      {finished || !ex.judge ? <Button title="Готово" onPress={done} /> : null}
      {finished ? <Button title="Ещё раз" variant="soft" onPress={() => setReps(0)} /> : null}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.sw, { borderColor: color }]} />
      <Text style={[styles.legendText, { color: c.inkMute }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  card: { borderRadius: radius.m, padding: 14, gap: 8 },
  label: { fontFamily: fonts.head700, fontSize: 12, letterSpacing: 1.2 },
  example: { width: '100%', aspectRatio: 1.25, borderRadius: radius.s, overflow: 'hidden', backgroundColor: '#E8E7EA' },
  step: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20 },
  camHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reps: { fontFamily: fonts.head700, fontSize: 14, fontVariant: ['tabular-nums'] },
  camera: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.s, overflow: 'hidden', backgroundColor: '#1B1420' },
  // тонкая рамка с отступом от краёв изображения
  frame: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, borderWidth: 2.5, borderRadius: 22 },
  hintWrap: { position: 'absolute', left: 28, right: 28, bottom: 28, alignItems: 'center' },
  hint: { backgroundColor: 'rgba(20,13,25,0.72)', borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14,
    paddingVertical: 8 },
  hintText: { color: '#fff', fontFamily: fonts.body600, fontSize: 13.5, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sw: { width: 16, height: 12, borderRadius: 4, borderWidth: 2 },
  legendText: { fontFamily: fonts.body600, fontSize: 12 },
  note: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
