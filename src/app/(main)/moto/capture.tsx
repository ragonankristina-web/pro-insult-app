import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PoseCamera } from '../../../components/PoseCamera';
import { BackHeader } from '../../../components/Shell';
import { Button } from '../../../components/ui';
import { react } from '../../../lib/brainyMood';
import { angle, KP, SCORE, type Keypoint, type PoseFrame } from '../../../lib/rtmpose';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Захват движений RTMPose: углы в плечах и локтях и раскрытие кистей, отдельно для левой и правой стороны.
// Стороны — самого пациента. Пороги раскрытия кисти примерные, их стоит сверить с врачами.

type Side = 'left' | 'right';
type Measures = { raise: number | null; elbow: number | null; hand: number | null };
const none: Measures = { raise: null, elbow: null, hand: null };

const sure = (...p: Keypoint[]) => p.every((q) => q.score > SCORE);
const dist = (a: Keypoint, b: Keypoint) => Math.hypot(a.x - b.x, a.y - b.y);

function measure(f: PoseFrame, side: Side): Measures {
  const p = f.points;
  const L = side === 'left';
  const sh = p[L ? KP.leftShoulder : KP.rightShoulder];
  const el = p[L ? KP.leftElbow : KP.rightElbow];
  const wr = p[L ? KP.leftWrist : KP.rightWrist];
  // Подъём руки: угол плечевой кости от вертикали вниз. 0° — опущена, 90° — горизонтально, 180° — вверх.
  const raise = sure(sh, el) ? (Math.acos(Math.max(-1, Math.min(1, (el.y - sh.y) / (dist(sh, el) || 1)))) * 180) / Math.PI : null;
  // Локоть: 180° — рука прямая.
  const elbow = sure(sh, el, wr) ? angle(sh, el, wr) : null;
  // Кисть: насколько кончики четырёх пальцев дальше от запястья, чем основание среднего пальца.
  // Кулак — около 1, раскрытая ладонь — около 1,8.
  const h = L ? KP.leftHand : KP.rightHand;
  const tips = [8, 12, 16, 20].map((i) => p[h + i]).filter((q) => q.score > SCORE);
  let hand: number | null = null;
  if (sure(p[h], p[h + 9]) && tips.length >= 3) {
    const r = tips.reduce((a, q) => a + dist(p[h], q), 0) / tips.length / (dist(p[h], p[h + 9]) || 1);
    hand = Math.round(Math.max(0, Math.min(1, (r - 1.05) / 0.75)) * 100);
  }
  return { raise: raise === null ? null : Math.round(raise), elbow: elbow === null ? null : Math.round(elbow), hand };
}

const max = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

export default function Capture() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState(false);
  const [now, setNow] = useState<Record<Side, Measures>>({ left: none, right: none });
  const [best, setBest] = useState<Record<Side, Measures>>({ left: none, right: none });
  const shownAt = useRef(0);

  // Камера даёт до 30 кадров в секунду — цифры обновляем 4 раза в секунду, чтобы их можно было прочитать.
  const onPose = (f: PoseFrame | null) => {
    setSeen(Boolean(f));
    const t = performance.now();
    if (!f || t - shownAt.current < 250) return;
    shownAt.current = t;
    const m = { left: measure(f, 'left'), right: measure(f, 'right') };
    // Рука поднята высоко (выше 150°) — Брэйни радуется.
    if ((m.left.raise ?? 0) >= 150 || (m.right.raise ?? 0) >= 150) react('happy');
    setNow(m);
    setBest((b) => {
      const up = (s: Side): Measures => ({
        raise: max(b[s].raise, m[s].raise),
        elbow: max(b[s].elbow, m[s].elbow),
        hand: max(b[s].hand, m[s].hand),
      });
      return { left: up('left'), right: up('right') };
    });
  };

  const rows: { title: string; hint: string; key: keyof Measures; unit: string }[] = [
    { title: 'Подъём руки', hint: '0° — опущена, 90° — в сторону, 180° — вверх', key: 'raise', unit: '°' },
    { title: 'Локоть', hint: '180° — рука прямая', key: 'elbow', unit: '°' },
    { title: 'Кисть раскрыта', hint: '0% — кулак, 100% — ладонь раскрыта', key: 'hand', unit: '%' },
  ];
  const v = (x: number | null, unit: string) => (x === null ? '—' : `${x}${unit}`);
  const gap = best.left.raise !== null && best.right.raise !== null ? Math.abs(best.left.raise - best.right.raise) : null;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Захват движений" />
        <Text style={[styles.lead, { color: c.inkSoft }]}>
          Сядьте перед камерой так, чтобы были видны плечи и руки. Медленно поднимайте руки, сгибайте локти, сжимайте и
          раскрывайте кисти — ниже видно углы для левой и правой стороны.
        </Text>

        <PoseCamera onPose={onPose} frameColor={seen ? '#2FD27A' : '#B9B4BC'} label="Точки найдены — двигайтесь медленно." />

        <View style={[styles.card, { backgroundColor: c.moto }]}>
          <View style={styles.row}>
            <Text style={[styles.head, styles.cellTitle, { color: c.inkSoft }]}> </Text>
            <Text style={[styles.head, styles.cell, { color: c.inkSoft }]}>Левая</Text>
            <Text style={[styles.head, styles.cell, { color: c.inkSoft }]}>Правая</Text>
          </View>
          {rows.map((r) => (
            <View key={r.key} style={[styles.row, styles.line, { backgroundColor: c.surface }]}>
              <View style={styles.cellTitle}>
                <Text style={[styles.title, { color: c.ink }]}>{r.title}</Text>
                <Text style={[styles.hint, { color: c.inkMute }]}>{r.hint}</Text>
              </View>
              {(['left', 'right'] as Side[]).map((s) => (
                <View key={s} style={styles.cell}>
                  <Text style={[styles.val, { color: c.heroNum }]}>{v(now[s][r.key], r.unit)}</Text>
                  <Text style={[styles.hint, { color: c.inkMute }]}>{`макс ${v(best[s][r.key], r.unit)}`}</Text>
                </View>
              ))}
            </View>
          ))}
          {gap !== null ? (
            <Text style={[styles.gap, { color: gap > 20 ? c.error : c.ok }]}>
              {`Разница сторон по подъёму руки: ${gap}°${gap > 20 ? ' — одна рука поднимается заметно хуже' : ''}`}
            </Text>
          ) : null}
        </View>

        <Button title="Сбросить максимумы" variant="soft" onPress={() => setBest({ left: none, right: none })} />
        <Text style={[styles.note, { color: c.inkMute }]}>
          Точки считает модель RTMPose прямо на этом устройстве — видео не записывается и никуда не отправляется.
          Стороны — ваши: левая рука в зеркале слева.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  lead: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20 },
  card: { borderRadius: radius.m, padding: 12, gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 },
  head: { fontFamily: fonts.body700, fontSize: 12.5 },
  cellTitle: { flex: 1.6, minWidth: 0 },
  cell: { flex: 1, alignItems: 'center', textAlign: 'center' },
  title: { fontFamily: fonts.body700, fontSize: 14 },
  hint: { fontFamily: fonts.body500, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  val: { fontFamily: fonts.head700, fontSize: 20, fontVariant: ['tabular-nums'] },
  gap: { fontFamily: fonts.body700, fontSize: 13, lineHeight: 18, marginTop: 2 },
  note: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 18 },
});
