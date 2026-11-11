import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader } from '../../../components/Shell';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Раздел «Моторика». Пока — проверка захвата движений; упражнения с видео-примерами добавим сюда же.
export default function Moto() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Моторика" />
        <Pressable
          onPress={() => router.push('/moto/capture')}
          accessibilityRole="button"
          accessibilityLabel="Захват движений: углы суставов и кисти"
          style={({ pressed }) => [styles.item, { backgroundColor: c.moto, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.pic, { backgroundColor: c.surface }]}>
            <Text style={styles.emoji}>🙆</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: c.ink }]}>Захват движений</Text>
            <Text style={[styles.about, { color: c.inkSoft }]}>
              Подъём рук, сгибание локтей и раскрытие кистей — левая и правая сторона.
            </Text>
          </View>
          <Text style={[styles.go, { color: c.magenta }]}>→</Text>
        </Pressable>
        <Text style={[styles.note, { color: c.inkMute }]}>
          Упражнения с вашими видео-примерами появятся здесь, как в разделе «Речь».
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.s, padding: 13, minHeight: 76 },
  pic: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26 },
  title: { fontFamily: fonts.body700, fontSize: 15 },
  about: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  go: { fontFamily: fonts.body700, fontSize: 18 },
  note: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 19 },
});
