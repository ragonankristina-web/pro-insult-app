import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../lib/Auth';

// Разделы для вошедших: без сессии — на стартовый экран, без профиля — завершить регистрацию.
export default function MainLayout() {
  const { ready, session, profile } = useAuth();
  if (ready && !session) return <Redirect href="/welcome" />;
  if (ready && !profile) return <Redirect href="/role" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
