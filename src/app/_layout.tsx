import { GolosText_600SemiBold, GolosText_700Bold } from '@expo-google-fonts/golos-text';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '../lib/Auth';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    GolosText_600SemiBold,
    GolosText_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  // Если шрифты не загрузились, работаем на системных — запуск не блокируем.
  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <Themed />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Themed() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}
