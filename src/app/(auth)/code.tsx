import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AuthScreen } from '../../components/AuthScreen';
import { Button, CodeInput, Notice } from '../../components/ui';
import { useAuth } from '../../lib/Auth';
import { formatPhone } from '../../lib/validation';

const RESEND_SEC = 60;

export default function Code() {
  const { verifyCode, sendCode } = useAuth();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_SEC);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (!phone) return <Redirect href="/phone" />;

  const submit = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(phone, value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode('');
      return;
    }
    // Знакомый номер → главный экран; новый человек без профиля будет перенаправлен на выбор роли.
    router.replace('/home');
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    const err = await sendCode(phone);
    if (err) return setError(err);
    setLeft(RESEND_SEC);
    setInfo('Новый код отправлен.');
  };

  return (
    <AuthScreen
      title="Введите код"
      subtitle={`Отправили СМС с кодом на ${formatPhone(phone)}.`}
      footer={
        <>
          <Button title="Войти" onPress={() => submit()} loading={busy} disabled={code.length < 6} />
          <Button
            title={left > 0 ? `Отправить код ещё раз через ${left} с` : 'Отправить код ещё раз'}
            variant="text"
            disabled={left > 0}
            onPress={resend}
          />
          <Button title="Изменить номер" variant="text" onPress={() => router.back()} />
        </>
      }
    >
      <CodeInput
        value={code}
        error={Boolean(error)}
        onChange={(v) => {
          setCode(v);
          setError(null);
          if (v.length === 6) submit(v); // код вставлен или подставлен из СМС — проверяем сразу
        }}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {info ? <Notice tone="ok">{info}</Notice> : null}
    </AuthScreen>
  );
}
