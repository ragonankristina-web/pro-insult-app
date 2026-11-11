import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrainyStage } from '../../../components/BrainyStage';
import { useStageActive } from '../../../lib/brainyMood';
import { BackHeader } from '../../../components/Shell';
import { fruitInfo } from '../../../lib/fruitGame';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Упражнения раздела «Мышление». Пока одно — игра «Фруктовый сад».
export default function Think() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const stage = useStageActive();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + (stage ? 24 : 140) }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Мышление" />
        <Pressable
          onPress={() => router.push('/think/fruit')}
          accessibilityRole="button"
          accessibilityLabel="Фруктовый сад: внимание, сортировка. 6 уровней"
          style={({ pressed }) => [styles.item, { backgroundColor: c.think, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.pic, { backgroundColor: c.surface }]}>
            <Image source={fruitInfo.apple.img} style={styles.img} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: c.ink }]}>Фруктовый сад</Text>
            <Text style={[styles.about, { color: c.inkSoft }]}>
              Внимание и сортировка · 6 уровней. Выбор корзины нажатием, голосом или поднятой рукой.
            </Text>
          </View>
          <Text style={[styles.go, { color: c.magenta }]}>→</Text>
        </Pressable>
        <BrainyStage />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.s, padding: 13, minHeight: 76 },
  pic: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', padding: 6 },
  img: { width: '100%', height: '100%' },
  title: { fontFamily: fonts.body700, fontSize: 15 },
  about: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  go: { fontFamily: fonts.body700, fontSize: 18 },
});
