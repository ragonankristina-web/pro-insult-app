import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '../../components/AuthScreen';
import { Button, Checkbox, Field, Notice } from '../../components/ui';
import { useAuth } from '../../lib/Auth';
import { roleInfo, type Role } from '../../lib/supabase';
import { checkName } from '../../lib/validation';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

const isRole = (v: unknown): v is Role => v === 'patient' || v === 'doctor' || v === 'caregiver';

// Завершение регистрации, шаг 2: имя и согласие на обработку данных (152-ФЗ). Сервер выдаёт личный номер.
export default function About() {
  const { c } = useTheme();
  const { session, profile, completeOnboarding } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (profile) return <Redirect href="/home" />;
  if (!isRole(params.role)) return <Redirect href="/role" />;
  const role = params.role;
  const info = roleInfo[role];
  const nameErr = checkName(name);

  const submit = async () => {
    setTried(true);
    setError(null);
    if (nameErr || !consent) return;
    setBusy(true);
    const err = await completeOnboarding({ role, fullName: name, consent });
    setBusy(false);
    if (err) return setError(err);
    router.replace({ pathname: '/profile', params: { welcome: '1' } });
  };

  return (
    <AuthScreen
      title="Как вас зовут?"
      subtitle={`Роль: ${info.who}. Имя увидят только те, с кем вы свяжетесь по номеру.`}
      step={{ n: 2, of: 2 }}
      footer={<Button title="Получить личный номер" onPress={submit} loading={busy} />}
    >
      <Field
        label={role === 'doctor' ? 'ФИО (как в дипломе)' : 'Имя и фамилия'}
        icon={role}
        value={name}
        onChangeText={setName}
        placeholder={role === 'doctor' ? 'Соколова Ирина Андреевна' : 'Алексей Петров'}
        autoComplete="name"
        textContentType="name"
        onSubmitEditing={submit}
        error={tried ? nameErr : null}
      />
      <View>
        <Checkbox checked={consent} onChange={setConsent}>
          Даю согласие на обработку моих персональных данных, в том числе сведений о здоровье, для работы
          приложения (152-ФЗ).
        </Checkbox>
        {tried && !consent ? (
          <Text style={[styles.err, { color: c.error }]}>Без согласия мы не можем хранить ваши данные</Text>
        ) : null}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  err: { fontFamily: fonts.body600, fontSize: 13, marginLeft: 38, marginTop: 4 },
});
