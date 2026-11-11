import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Sect } from '../../components/Shell';
import { lessonBlocks, type Metric } from '../../lib/demo';
import { speechExercises } from '../../lib/exercises';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

// Библиотека упражнений для врача: всё, что есть в приложении, по видам реабилитации.
// Готовые упражнения открываются; запланированные (из программы-примера) помечены «скоро».

type Item = { title: string; about: string; path?: string };

const planned = (m: Metric): Item[] =>
  (lessonBlocks.find((b) => b.metric === m)?.lessons ?? []).map((l) => ({ title: l.title, about: l.about }));

const sections: { metric: Metric; title: string; items: Item[] }[] = [
  {
    metric: 'moto',
    title: 'Моторика',
    items: [
      { title: 'Захват движений', about: 'углы плеч и локтей, раскрытие кистей · камера', path: '/moto/capture' },
      ...planned('moto'),
    ],
  },
  {
    metric: 'speech',
    title: 'Речь',
    items: [
      ...speechExercises.map((e) => ({ title: e.title, about: `${e.group} · ${e.about}`, path: `/speech/${e.id}` })),
      ...planned('speech'),
    ],
  },
  {
    metric: 'think',
    title: 'Мышление',
    items: [
      { title: 'Фруктовый сад', about: 'внимание и сортировка · 6 уровней', path: '/think/fruit' },
      ...planned('think'),
    ],
  },
];

export default function Library() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const ready = sections.reduce((a, s) => a + s.items.filter((i) => i.path).length, 0);
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Библиотека упражнений" />
        <Text style={[styles.lead, { color: c.inkSoft }]}>
          {`Готово упражнений: ${ready}. Нажмите, чтобы посмотреть, как упражнение видит пациент.`}
        </Text>
        {sections.map((s) => (
          <View key={s.metric} style={{ gap: 8 }}>
            <Sect>{s.title}</Sect>
            {s.items.map((i) => (
              <Pressable
                key={i.title}
                disabled={!i.path}
                onPress={() => i.path && router.push(i.path as never)}
                accessibilityRole="button"
                accessibilityLabel={`${i.title}, ${i.about}${i.path ? '' : ', скоро'}`}
                style={({ pressed }) => [styles.item, { backgroundColor: c[s.metric], opacity: !i.path ? 0.6 : pressed ? 0.8 : 1 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.title, { color: c.ink }]}>{i.title}</Text>
                  <Text style={[styles.about, { color: c.inkSoft }]}>{i.about}</Text>
                </View>
                <Text style={[styles.go, { color: i.path ? c.magenta : c.inkMute }]}>{i.path ? '→' : 'скоро'}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  lead: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.s, padding: 13, minHeight: 64 },
  title: { fontFamily: fonts.body700, fontSize: 15 },
  about: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  go: { fontFamily: fonts.body700, fontSize: 14 },
});
