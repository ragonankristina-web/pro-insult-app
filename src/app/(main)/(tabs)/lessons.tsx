import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DoctorLessons } from '../../../components/DoctorLessons';
import { PageHeader, TabScreen, useSoon } from '../../../components/Shell';
import { useAuth } from '../../../lib/Auth';
import { lessonBlocks, type Metric } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Разделы, где уже есть свои упражнения: нажатие на ярлык блока открывает их список.
const sections: Partial<Record<Metric, string>> = { moto: '/moto', speech: '/speech', think: '/think' };

// Занятия на сегодня: блоки «Мышление», «Моторика», «Речь». У врача — групповые и индивидуальные занятия.
export default function Lessons() {
  const { profile } = useAuth();
  return profile?.role === 'doctor' ? <DoctorLessons /> : <TodayLessons />;
}

function TodayLessons() {
  const { c } = useTheme();
  const soon = useSoon();
  return (
    <TabScreen header={<PageHeader title="Занятия на сегодня" />}>
      {lessonBlocks.map((b) => {
        const done = b.lessons.filter((l) => l.done).length;
        return (
          <View key={b.metric} style={[styles.block, { backgroundColor: c[b.metric] }]}>
            {sections[b.metric] ? (
              <Pressable
                onPress={() => router.push(sections[b.metric] as never)}
                accessibilityRole="button"
                accessibilityLabel={`${b.title} — все упражнения`}
                style={({ pressed }) => [styles.tag, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.tagText, { color: c.ink }]}>
                  {b.title.toUpperCase()}
                  <Text style={{ color: c.magenta }}>{'  · все упражнения →'}</Text>
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.tag, { backgroundColor: c.surface }]}>
                <Text style={[styles.tagText, { color: c.ink }]}>{b.title.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.list}>
              {b.lessons.map((l, i) => (
                <Pressable
                  key={l.title}
                  onPress={() => soon(l.done ? 'Упражнение уже выполнено сегодня.' : 'Здесь откроется упражнение.')}
                  accessibilityRole="button"
                  accessibilityLabel={`${l.title}, ${l.about}${l.done ? ', выполнено' : ''}`}
                  style={({ pressed }) => [styles.item, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 0.9 }]}
                >
                  <View style={[styles.num, { backgroundColor: c.pink2 }]}>
                    <Text style={[styles.numText, { color: c.inkSoft }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.itemTitle, { color: c.ink }]}>{l.title}</Text>
                    <Text style={[styles.itemAbout, { color: c.inkSoft }]}>{l.about}</Text>
                  </View>
                  <Text style={[styles.st, { color: l.done ? c.ok : c.magenta }]}>{l.done ? '✓' : '→'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.foot}>
              <Text style={[styles.footText, { color: c.inkSoft }]}>{`Выполнено ${done} из ${b.lessons.length}`}</Text>
              <Text style={[styles.footText, { color: c.inkSoft }]}>{b.foot}</Text>
            </View>
          </View>
        );
      })}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.m, padding: 14 },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 7, marginBottom: 11 },
  tagText: { fontFamily: fonts.head700, fontSize: 13, letterSpacing: 0.9 },
  list: { gap: 7 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11,
    minHeight: 60 },
  num: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.head700, fontSize: 12 },
  itemTitle: { fontFamily: fonts.body700, fontSize: 14.5, lineHeight: 19 },
  itemAbout: { fontFamily: fonts.body500, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  st: { fontFamily: fonts.body700, fontSize: 18 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  footText: { fontFamily: fonts.body600, fontSize: 12.5 },
});
