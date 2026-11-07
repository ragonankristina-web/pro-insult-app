import type { Role } from './supabase';

// Вход для разработчика: тестовые номера Supabase (sms_test_otp в настройках входа) — без СМС.
// Виден в режиме разработки или при EXPO_PUBLIC_DEV_LOGIN=1 в .env (например, для демо-сборки).
export const devLoginEnabled = __DEV__ || process.env.EXPO_PUBLIC_DEV_LOGIN === '1';

export const devAccounts: Record<Role, { phone: string; code: string; name: string }> = {
  patient: { phone: '+79990000001', code: '111111', name: 'Алексей Петрович (тест)' },
  caregiver: { phone: '+79990000002', code: '222222', name: 'Мария Петровна (тест)' },
  doctor: { phone: '+79990000003', code: '333333', name: 'Ирина Соколова (тест)' },
};

// Supabase хранит номер без «+».
export function isDevPhone(phone: string | undefined) {
  return Object.values(devAccounts).some((a) => a.phone === `+${phone ?? ''}`);
}
