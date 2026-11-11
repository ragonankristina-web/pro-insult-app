import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '../../../components/Shell';
import { Button } from '../../../components/ui';
import { shortName, useClinic, type Session } from '../../../lib/clinic';
import { addDays, monthsOf, today, weekHead } from '../../../lib/dates';
import { metricName, type Metric } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

const metrics: Metric[] = ['moto', 'speech', 'think'];
const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const lengths = [30, 45, 60];

// Назначение занятия врачом: индивидуальное (один пациент) или групповое (несколько).
// Пока занятие добавляется в демонстрационное расписание и живёт до перезапуска приложения.
export default function NewSession() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const clinic = useClinic();
  const params = useLocalSearchParams<{ kind?: string; patient?: string }>();
  const [kind, setKind] = useState<Session['kind']>(params.kind === 'group' ? 'group' : 'individual');
  const [metric, setMetric] = useState<Metric>('moto');
  const [chosen, setChosen] = useState<string[]>(params.patient ? [params.patient] : []);
  const [day, setDay] = useState(1); // через сколько дней от сегодня
  const [hour, setHour] = useState(11);
  const [minutes, setMinutes] = useState(30);
  const [title, setTitle] = useState('');

  const pick = (id: string) =>
    setChosen((list) => (kind === 'individual' ? [id] : list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const switchKind = (k: Session['kind']) => {
    setKind(k);
    if (k === 'individual') setChosen((list) => list.slice(0, 1));
  };
  const date = addDays(today(), day);
  const auto = `${metricName[metric][0].toUpperCase()}${metricName[metric].slice(1)} — ${kind === 'group' ? 'группа' : 'индивидуально'}`;
  const ready = kind === 'individual' ? chosen.length === 1 : chosen.length >= 2;

  const save = () => {
    clinic.addSession({
      at: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour),
      minutes,
      kind,
      metric,
      title: title.trim() || auto,
      patientIds: chosen,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/lessons');
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <BackHeader title="Новое занятие" />

        <Field label="Вид занятия">
          <Chip on={kind === 'individual'} onPress={() => switchKind('individual')} wide>Индивидуальное</Chip>
          <Chip on={kind === 'group'} onPress={() => switchKind('group')} wide>Групповое</Chip>
        </Field>

        <Field label="Направление">
          {metrics.map((m) => (
            <Chip key={m} on={metric === m} onPress={() => setMetric(m)} tint={c[m]}>{metricName[m]}</Chip>
          ))}
        </Field>

        <Field label={kind === 'individual' ? 'Пациент' : `Пациенты (выбрано ${chosen.length}, нужно от 2)`}>
          {clinic.patients.map((p) => (
            <Chip key={p.id} on={chosen.includes(p.id)} onPress={() => pick(p.id)}>{shortName(p.name)}</Chip>
          ))}
        </Field>

        <Field label={`День · ${date.getDate()} ${monthsOf[date.getMonth()]}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {Array.from({ length: 14 }, (_, i) => {
              const d = addDays(today(), i);
              return (
                <Chip key={i} on={day === i} onPress={() => setDay(i)}>
                  {i === 0 ? 'сегодня' : i === 1 ? 'завтра' : `${weekHead[(d.getDay() + 6) % 7]} ${d.getDate()}`}
                </Chip>
              );
            })}
          </ScrollView>
        </Field>

        <Field label="Время">
          {hours.map((h) => (
            <Chip key={h} on={hour === h} onPress={() => setHour(h)}>{`${h}:00`}</Chip>
          ))}
        </Field>

        <Field label="Длительность">
          {lengths.map((m) => (
            <Chip key={m} on={minutes === m} onPress={() => setMinutes(m)}>{`${m} мин`}</Chip>
          ))}
        </Field>

        <Field label="Название (необязательно)">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={auto}
            placeholderTextColor={c.inkMute}
            accessibilityLabel="Название занятия"
            style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
          />
        </Field>

        <Button title="Назначить" onPress={save} disabled={!ready} />
        {!ready ? (
          <Text style={[styles.hint, { color: c.inkMute }]}>
            {kind === 'individual' ? 'Выберите пациента.' : 'Выберите хотя бы двух пациентов.'}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({ on, onPress, tint, wide, children }: {
  on: boolean; onPress: () => void; tint?: string; wide?: boolean; children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[
        styles.chip,
        wide && { flex: 1 },
        { backgroundColor: on ? c.magenta : tint ?? c.pink2, borderColor: on ? c.magenta : 'transparent' },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? c.onGrad : c.pinkInk }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 18 },
  label: { fontFamily: fonts.head700, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  hscroll: { gap: 7 },
  chip: { borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: 14, minHeight: 42, alignItems: 'center',
    justifyContent: 'center' },
  chipText: { fontFamily: fonts.body700, fontSize: 13.5 },
  input: { flex: 1, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 50,
    fontFamily: fonts.body500, fontSize: 15, outlineWidth: 0 },
  hint: { fontFamily: fonts.body500, fontSize: 13, textAlign: 'center', marginTop: -8 },
});
