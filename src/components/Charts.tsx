import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Day, Metric } from '../lib/demo';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

// Графики главного экрана. id градиентов уникальны: в браузере все SVG страницы делят одно пространство id.

const R = 78;
const LEN = 2 * Math.PI * R;

// size — диаметр кольца (по умолчанию 188); на узком экране главной кольцо меньше, чтобы рядом поместился Брэйни.
export function Ring({ share, caption, size = 188 }: { share: number; caption: string; size?: number }) {
  const k = size / 188;
  const { c } = useTheme();
  const pct = Math.round(share * 100);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${pct}% ${caption.replace('\n', ' ')}`}>
      <Svg width={size} height={size} viewBox="0 0 188 188" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.g1} />
            <Stop offset="1" stopColor={c.g2} />
          </LinearGradient>
        </Defs>
        <Circle cx={94} cy={94} r={R} fill="none" stroke={c.ringTrack} strokeWidth={17} />
        <Circle cx={94} cy={94} r={R} fill="none" stroke="url(#ringGrad)" strokeWidth={17} strokeLinecap="round"
          strokeDasharray={`${LEN} ${LEN}`} strokeDashoffset={LEN * (1 - share)} />
      </Svg>
      <View style={styles.ringMid}>
        <Text style={[styles.pct, { color: c.heroNum, fontSize: 44 * k, lineHeight: 48 * k }]}>{pct}%</Text>
        <Text style={[styles.cap, { color: c.pinkInk, fontSize: Math.max(11.5, 13 * k), lineHeight: Math.max(15, 18 * k) }]}>{caption}</Text>
      </View>
    </View>
  );
}

const W = 150;
const H = 76;
const P = 4;

export function ProgressLine({ data, metric }: { data: Day[]; metric: Metric }) {
  const { c } = useTheme();
  const v = data.map((d) => d[metric]);
  const lo = Math.floor((Math.min(...v) - 4) / 5) * 5;
  const hi = Math.ceil((Math.max(...v) + 4) / 5) * 5;
  const X = (i: number) => P + (i * (W - 2 * P)) / (v.length - 1);
  const Y = (n: number) => P + ((hi - n) / (hi - lo)) * (H - 2 * P - 8);
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(n).toFixed(1)}`).join(' ');
  const last = v.length - 1;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={styles.chart}>
      <Defs>
        <LinearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.g1} />
          <Stop offset="1" stopColor={c.g2} />
        </LinearGradient>
        <LinearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.magenta} stopOpacity={0.3} />
          <Stop offset="1" stopColor={c.magenta} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`${d} L${X(last).toFixed(1)} ${H - P} L${X(0).toFixed(1)} ${H - P} Z`} fill="url(#lineArea)" />
      <Path d={d} fill="none" stroke="url(#lineStroke)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={X(last)} cy={Y(v[last])} r={3.4} fill={c.surface} stroke={c.magenta} strokeWidth={2.4} />
    </Svg>
  );
}

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']; // по Date.getDay()

export function WeekBars({ week, perDay }: { week: Day[]; perDay: number }) {
  const { c } = useTheme();
  const n = week.length;
  const slot = (W - 2 * P) / n;
  const bw = slot * 0.6;
  return (
    <View>
      <Svg viewBox={`0 0 ${W} ${H - 9}`} preserveAspectRatio="none" style={[styles.chart, { aspectRatio: W / (H - 9) }]}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={c.g1} />
            <Stop offset="1" stopColor={c.g2} />
          </LinearGradient>
        </Defs>
        {week.map((d, i) => {
          const h = Math.max(3, (d.done / perDay) * (H - 2 * P - 11));
          const x = P + i * slot + (slot - bw) / 2;
          return <Rect key={i} x={x} y={H - 9 - P - h} width={bw} height={h} rx={2.5} fill={d.done ? 'url(#barGrad)' : c.line} />;
        })}
      </Svg>
      <View style={styles.days}>
        {week.map((d, i) => (
          <Text key={i} style={[styles.day, { color: c.inkMute }]}>{DAYS[d.date.getDay()]}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringMid: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: fonts.head700, fontSize: 44, lineHeight: 48, fontVariant: ['tabular-nums'] },
  cap: { fontFamily: fonts.body600, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  chart: { width: '100%', aspectRatio: W / H },
  days: { flexDirection: 'row', paddingHorizontal: 2 },
  day: { flex: 1, textAlign: 'center', fontFamily: fonts.body600, fontSize: 10 },
});
