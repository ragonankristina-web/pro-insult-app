import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AiRail, PageHeader, TabScreen, useSoon } from '../../../components/Shell';
import { Notice } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { lessonBlocks } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Занятия на сегодня: блоки «Мышление», «Моторика», «Речь»; справа — панель ассистента.
export default function Lessons() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const soon = useSoon();
  const doctor = profile?.role === 'doctor';
  return (
    <TabScreen
      header={<PageHeader title={doctor ? 'Программа пациента · пример' : 'Занятия на сегодня'} />}
      overlay={doctor ? null : <AiRail />}
      contentStyle={doctor ? null : { paddingRight: 62 }}
    >
      {doctor ? (
        <Notice tone="info">Здесь врач будет назначать и менять упражнения пациента.</Notice>
      ) : null}
      {lessonBlocks.map((b) => {
        const done = b.lessons.filter((l) => l.done).length;
        return (
          <View key={b.metric} style={[styles.block, { backgroundColor: c[b.metric] }]}>
            <View style={[styles.tag, { backgroundColor: c.surface }]}>
              <Text style={[styles.tagText, { color: c.ink }]}>{b.title.toUpperCase()}</Text>
            </View>
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
