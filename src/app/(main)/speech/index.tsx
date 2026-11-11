import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Sect } from '../../../components/Shell';
import { speechExercises, speechGroups } from '../../../lib/exercises';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Все упражнения раздела «Речь», по группам (губы, язык, щёки). По нажатию — экран упражнения.
export default function Speech() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Речь" />
        <Text style={[styles.lead, { color: c.inkSoft }]}>
          Выберите упражнение. Сверху будет пример, снизу — камера: рамка станет зелёной, если движение верное.
        </Text>
        {speechGroups.map((g) => (
          <View key={g} style={styles.group}>
            <Sect>{g}</Sect>
            {speechExercises
              .filter((e) => e.group === g)
              .map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => router.push({ pathname: '/speech/[id]', params: { id: e.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.title}, ${e.about}`}
                  style={({ pressed }) => [styles.item, { backgroundColor: c.speech, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.play, { backgroundColor: c.surface }]}>
                    <Text style={[styles.playText, { color: c.magenta }]}>▶</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.title, { color: c.ink }]}>{e.title}</Text>
                    <Text style={[styles.about, { color: c.inkSoft }]}>
                      {e.judge ? e.about : `${e.about} · без автопроверки`}
                    </Text>
                  </View>
                  <Text style={[styles.go, { color: c.magenta }]}>→</Text>
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
  group: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.s, padding: 13, minHeight: 66 },
  play: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  playText: { fontSize: 15 },
  title: { fontFamily: fonts.body700, fontSize: 15 },
  about: { fontFamily: fonts.body500, fontSize: 12.5, marginTop: 2 },
  go: { fontFamily: fonts.body700, fontSize: 18 },
});
