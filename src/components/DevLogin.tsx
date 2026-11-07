import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../lib/Auth';
import { roleInfo, type Role } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Icon } from './Icon';
import { Notice } from './ui';

const devOrder: Role[] = ['patient', 'caregiver', 'doctor'];

// Вход для разработчика: тестовые аккаунты всех ролей без СМС. В рабочей сборке не показывается.
export function DevLogin({ current }: { current?: Role }) {
  const { c } = useTheme();
  const { devSignIn } = useAuth();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async (role: Role) => {
    setBusy(role);
    setError(null);
    const err = await devSignIn(role);
    setBusy(null);
    if (err) setError(err);
    // Со стартового экрана — новым шагом истории (кнопка «назад» вернёт сюда); из профиля — заменой.
    else if (current) router.replace('/home');
    else router.push('/home');
  };
  return (
    <View style={[styles.dev, { borderColor: c.line }]}>
      <Text style={[styles.devTitle, { color: c.inkSoft }]}>Вход для разработчика · без СМС</Text>
      <View style={styles.devRow}>
        {devOrder.map((r) => (
          <Pressable
            key={r}
            onPress={() => go(r)}
            disabled={busy !== null || r === current}
            accessibilityRole="button"
            accessibilityState={{ selected: r === current, busy: busy === r }}
            style={({ pressed }) => [
              styles.devBtn,
              { backgroundColor: r === current ? c.magenta : c.pink2, opacity: pressed || (busy && busy !== r) ? 0.6 : 1 },
            ]}
          >
            <Icon name={r} color={r === current ? c.onGrad : c.pinkInk} size={20} />
            <Text style={[styles.devBtnText, { color: r === current ? c.onGrad : c.pinkInk }]}>
              {busy === r ? '…' : roleInfo[r].title}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dev: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.m, padding: 12, gap: 10, marginTop: 4 },
  devTitle: { fontFamily: fonts.body700, fontSize: 13, textAlign: 'center' },
  devRow: { flexDirection: 'row', gap: 8 },
  devBtn: { flex: 1, minHeight: 64, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 4 },
  devBtnText: { fontFamily: fonts.body700, fontSize: 13 },
});
