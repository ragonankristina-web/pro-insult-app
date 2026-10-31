import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean;
  step?: { n: number; of: number };
  children: ReactNode;
  footer?: ReactNode;
};

// Общий каркас экранов входа и регистрации: назад, тема, шаг, заголовок, содержимое.
export function AuthScreen({ title, subtitle, back = true, step, children, footer }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.top}>
            {back ? (
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
                accessibilityRole="button"
                accessibilityLabel="Назад"
                style={[styles.round, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <Icon name="back" color={c.inkSoft} />
              </Pressable>
            ) : (
              <View style={styles.round} />
            )}
            {step ? <Steps {...step} /> : null}
            <ThemeToggle />
          </View>
          <View style={styles.titles}>
            <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: c.inkSoft }]}>{subtitle}</Text> : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Steps({ n, of }: { n: number; of: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.steps} accessibilityLabel={`Шаг ${n} из ${of}`}>
      {Array.from({ length: of }).map((_, i) => (
        <View key={i} style={[styles.stepDot, { backgroundColor: i < n ? c.magenta : c.line, width: i === n - 1 ? 26 : 10 }]} />
      ))}
    </View>
  );
}

export function ThemeToggle() {
  const { c, dark, toggle } = useTheme();
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel="Тёмная тема"
      style={[styles.round, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <Icon name={dark ? 'sun' : 'moon'} color={c.inkSoft} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', alignItems: 'center',
    justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6 },
  stepDot: { height: 10, borderRadius: radius.pill },
  titles: { marginTop: 22, marginBottom: 20, gap: 8 },
  title: { fontFamily: fonts.head700, fontSize: 30, lineHeight: 36 },
  subtitle: { fontFamily: fonts.body500, fontSize: 16, lineHeight: 23 },
  body: { gap: 16 },
  footer: { marginTop: 'auto', paddingTop: 24, gap: 6 },
});
