import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '../../components/AuthScreen';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/Auth';
import { roleInfo, type Role } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

const order: Role[] = ['patient', 'caregiver', 'doctor'];

// Завершение регистрации, шаг 1 (после входа по коду): кто вы. От роли зависит личный номер и разделы приложения.
export default function RolePick() {
  const { c } = useTheme();
  const [role, setRole] = useState<Role | null>(null);
  const { session, profile, signOut } = useAuth();
  if (!session) return <Redirect href="/welcome" />;
  if (profile) return <Redirect href="/home" />;
  return (
    <AuthScreen
      title="Кто вы?"
      subtitle="Роль определяет ваш личный номер и разделы приложения. Изменить её потом нельзя."
      back={false}
      step={{ n: 1, of: 2 }}
      footer={
        <>
          <Button title="Продолжить" disabled={!role} onPress={() => role && router.push({ pathname: '/about', params: { role } })} />
          <Button title="Выйти и сменить номер" variant="text" onPress={signOut} />
        </>
      }
    >
      <View style={styles.list} accessibilityRole="radiogroup">
        {order.map((r) => {
          const on = r === role;
          const info = roleInfo[r];
          return (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: on ? c.pink : c.surface, borderColor: on ? c.magenta : c.line, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: on ? c.surface : c.pink2 }]}>
                <Icon name={r} color={c.plum} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: c.ink }]}>{info.title}</Text>
                <Text style={[styles.cardText, { color: c.inkSoft }]}>{info.about}</Text>
                <Text style={[styles.prefix, { color: c.magenta }]}>{`Номер: ${info.prefix}-0001`}</Text>
              </View>
              <View style={[styles.radio, { borderColor: on ? c.magenta : c.line }]}>
                {on ? <View style={[styles.radioDot, { backgroundColor: c.magenta }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderRadius: radius.m, padding: 16 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.head700, fontSize: 18 },
  cardText: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20, marginTop: 2 },
  prefix: { fontFamily: fonts.body700, fontSize: 13, marginTop: 6 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
});
