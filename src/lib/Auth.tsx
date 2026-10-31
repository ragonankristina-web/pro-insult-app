import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { backendConfigured, supabase, type Profile, type Role } from './supabase';
import { ruAuthError } from './validation';

// Результат действия: null — успех, строка — ошибка для показа пользователю.
type Result = Promise<string | null>;

type Auth = {
  ready: boolean; // сессия восстановлена и профиль загружен (или его нет)
  session: Session | null;
  profile: Profile | null; // null при входе — регистрацию нужно завершить (роль, имя, согласие)
  sendCode: (phone: string) => Result;
  verifyCode: (phone: string, code: string) => Result;
  completeOnboarding: (p: { role: Role; fullName: string; consent: boolean }) => Result;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!backendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) return setProfile(null);
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, personal_number')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    if (!backendConfigured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Supabase не разрешает ждать запросы внутри этого обработчика — грузим профиль отдельно.
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Код приходит в СМС (или звонком — зависит от подключённого сервиса). Аккаунт создаётся при первом входе.
  const sendCode: Auth['sendCode'] = useCallback(async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (!error) return null;
    // Ограничение частоты и сеть объясняем как есть; любая другая ошибка здесь — сбой отправки СМС
    // (а не «неверный код», как могло бы показаться по тексту ошибки поставщика СМС).
    const known = ruAuthError(error.message);
    if (/Слишком много|Нет связи|Регистрация/.test(known)) return known;
    console.warn('SMS send failed:', error.message);
    return 'Не удалось отправить СМС. Проверьте номер и попробуйте через минуту.';
  }, []);

  const verifyCode: Auth['verifyCode'] = useCallback(async (phone, code) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error) return ruAuthError(error.message);
    setSession(data.session);
    await loadProfile(data.user?.id);
    return null;
  }, [loadProfile]);

  const completeOnboarding: Auth['completeOnboarding'] = useCallback(async ({ role, fullName, consent }) => {
    const { data, error } = await supabase.rpc('complete_onboarding', {
      p_role: role,
      p_full_name: fullName.trim(),
      p_consent: consent,
    });
    if (error) return ruAuthError(error.message);
    const p = data as Profile;
    setProfile({ id: p.id, role: p.role, full_name: p.full_name, personal_number: p.personal_number });
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, sendCode, verifyCode, completeOnboarding, signOut }),
    [ready, session, profile, sendCode, verifyCode, completeOnboarding, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside <AuthProvider>');
  return a;
}
