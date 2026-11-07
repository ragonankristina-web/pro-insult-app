import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { devAccounts } from './dev';
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
  devSignIn: (role: Role) => Result;
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

  // Вход (или смена роли) тестовым аккаунтом без СМС. Пока идёт вход, ready = false —
  // экраны не перенаправляют на выбор роли, пока у нового аккаунта нет профиля.
  const devSignIn: Auth['devSignIn'] = useCallback(async (role) => {
    const acc = devAccounts[role];
    setReady(false);
    setProfile(null);
    try {
      // Тестовому номеру СМС не отправляется; запрос нужен, чтобы аккаунт существовал.
      // Ошибку «слишком часто» игнорируем — код тестового номера всё равно действует.
      await supabase.auth.signInWithOtp({ phone: acc.phone });
      const { data, error } = await supabase.auth.verifyOtp({ phone: acc.phone, token: acc.code, type: 'sms' });
      if (error) return ruAuthError(error.message);
      setSession(data.session);
      const { data: existing } = await supabase.from('profiles').select('role').eq('id', data.user!.id).maybeSingle();
      if (existing && existing.role !== role) {
        await loadProfile(data.user!.id);
        return `Тестовый номер ${acc.phone} уже зарегистрирован с другой ролью.`;
      }
      if (!existing) {
        const { error: e } = await supabase.rpc('complete_onboarding', { p_role: role, p_full_name: acc.name, p_consent: true });
        if (e) return ruAuthError(e.message);
      }
      await loadProfile(data.user!.id);
      return null;
    } finally {
      setReady(true);
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, profile, sendCode, verifyCode, completeOnboarding, devSignIn, signOut }),
    [ready, session, profile, sendCode, verifyCode, completeOnboarding, devSignIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside <AuthProvider>');
  return a;
}
