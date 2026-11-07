import { Redirect, router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '../../components/AuthScreen';
import { Button, Notice } from '../../components/ui';
import { DevLogin } from '../../components/DevLogin';
import { useAuth } from '../../lib/Auth';
import { devLoginEnabled } from '../../lib/dev';
import { backendConfigured } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

const logo = require('../../../assets/logo.png');

export default function Welcome() {
  const { c } = useTheme();
  const { session, ready } = useAuth();
  const insets = useSafeAreaInsets();
  if (session && ready) return <Redirect href="/" />;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.inner}>
        <View style={styles.top}>
          <ThemeToggle />
        </View>

        <View style={[styles.hero, { backgroundColor: c.pink }]}>
          <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors accessibilityLabel="Логотип PRO Инсульт" />
          <Text style={[styles.brand, { color: c.heroNum }]}>PRO Инсульт</Text>
          <Text style={[styles.tagline, { color: c.pinkInk }]}>
            Домашняя реабилитация после инсульта под контролем лечащего врача
          </Text>
        </View>

        <View style={styles.points}>
          {[
            'Занятия на моторику, речь и мышление по программе врача',
            'Врач и близкие видят прогресс и всегда на связи',
            'Каждый участник получает личный номер для связи',
          ].map((t) => (
            <View key={t} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: c.magenta }]} />
              <Text style={[styles.pointText, { color: c.inkSoft }]}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {!backendConfigured ? (
            <Notice tone="error">Не настроено подключение к серверу: нет файла .env с адресом Supabase.</Notice>
          ) : null}
          <Button title="Войти по номеру телефона" onPress={() => router.push('/phone')} disabled={!backendConfigured} />
          {/* VK ID подключается после регистрации приложения на id.vk.com/business — до этого кнопка неактивна. */}
          <Button title="Войти через VK ID · скоро" variant="soft" disabled />
          <Text style={[styles.legal, { color: c.inkMute }]}>
            Новый номер — новый аккаунт: регистрация и вход происходят одинаково.
          </Text>
          {devLoginEnabled && backendConfigured ? <DevLogin /> : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { marginTop: 14, borderRadius: radius.l, paddingVertical: 30, paddingHorizontal: 22, alignItems: 'center', gap: 10 },
  logo: { width: 108, height: 108, borderRadius: 32 },
  brand: { fontFamily: fonts.head700, fontSize: 32, marginTop: 6 },
  tagline: { fontFamily: fonts.body600, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  points: { gap: 12, marginTop: 24 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  pointText: { flex: 1, fontFamily: fonts.body500, fontSize: 15, lineHeight: 22 },
  actions: { marginTop: 'auto', paddingTop: 24, gap: 12 },
  legal: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
