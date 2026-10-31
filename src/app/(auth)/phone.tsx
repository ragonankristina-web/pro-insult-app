import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthScreen } from '../../components/AuthScreen';
import { Button, Field, Notice } from '../../components/ui';
import { useAuth } from '../../lib/Auth';
import { checkPhone, normalizePhone, phoneInput } from '../../lib/validation';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

// Вход и регистрация — один экран: если номера ещё нет, аккаунт создастся после кода.
export default function Phone() {
  const { c } = useTheme();
  const { sendCode } = useAuth();
  const [phone, setPhone] = useState('+7 ');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneErr = checkPhone(phone);

  const submit = async () => {
    setTried(true);
    setError(null);
    if (phoneErr) return;
    setBusy(true);
    const p = normalizePhone(phone);
    const err = await sendCode(p);
    setBusy(false);
    if (err) return setError(err);
    router.push({ pathname: '/code', params: { phone: p } });
  };

  return (
    <AuthScreen
      title="Вход по номеру телефона"
      subtitle="Пришлём код в СМС. Если вы у нас впервые, аккаунт создастся автоматически."
      footer={<Button title="Получить код" onPress={submit} loading={busy} />}
    >
      <Field
        label="Номер мобильного телефона"
        icon="phone"
        value={phone}
        onChangeText={(t) => {
          setPhone(phoneInput(t));
          setError(null);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        onSubmitEditing={submit}
        error={tried ? phoneErr : null}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Text style={[styles.legal, { color: c.inkMute }]}>
        Номер нужен только для входа. Мы не показываем его другим пользователям: для связи с врачом и близкими
        используется личный номер вида #пац-0001.
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  legal: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 19 },
});
