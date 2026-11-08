import { Redirect, Stack } from 'expo-router';

import { Brainy } from '../../components/Brainy';
import { useAuth } from '../../lib/Auth';
import { ChatProvider } from '../../lib/chat';

// Разделы для вошедших: без сессии — на стартовый экран, без профиля — завершить регистрацию.
// Поверх всех разделов — ассистент Брэйни.
export default function MainLayout() {
  const { ready, session, profile } = useAuth();
  if (ready && !session) return <Redirect href="/welcome" />;
  if (ready && !profile) return <Redirect href="/role" />;
  return (
    <ChatProvider key={profile?.role}>
      <Brainy>
        <Stack screenOptions={{ headerShown: false }} />
      </Brainy>
    </ChatProvider>
  );
}
