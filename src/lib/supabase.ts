import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Адрес проекта и публичный ключ — из .env (см. .env.example). Публичный ключ можно хранить
// в приложении: что кому доступно, решают правила доступа в supabase/schema.sql.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const backendConfigured = Boolean(url && key);

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// На телефоне обновляем токен только пока приложение открыто.
if (Platform.OS !== 'web' && backendConfigured) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Role = 'patient' | 'doctor' | 'caregiver';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  personal_number: string;
};

export type Link = {
  id: number;
  status: 'pending' | 'accepted';
  incoming: boolean;
  other_name: string;
  other_number: string;
  other_role: Role;
  created_at: string;
};

export const roleInfo: Record<Role, { title: string; who: string; prefix: string; about: string }> = {
  patient: {
    title: 'Пациент',
    who: 'пациент',
    prefix: '#пац',
    about: 'Занимаюсь по программе врача: моторика, речь, мышление',
  },
  caregiver: {
    title: 'Ухаживающий',
    who: 'ухаживающий',
    prefix: '#ухаж',
    about: 'Помогаю близкому: вижу его занятия и самочувствие',
  },
  doctor: {
    title: 'Врач',
    who: 'врач',
    prefix: '#врач',
    about: 'Веду пациентов: назначаю программу и слежу за динамикой',
  },
};
