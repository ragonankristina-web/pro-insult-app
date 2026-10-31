import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../lib/Auth';
import { useTheme } from '../theme/ThemeContext';

// Точка входа: не вошёл → стартовый экран; вошёл впервые → выбор роли; иначе → личный кабинет.
export default function Index() {
  const { ready, session, profile } = useAuth();
  const { c } = useTheme();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.magenta} size="large" />
      </View>
    );
  }
  return <Redirect href={!session ? '/welcome' : profile ? '/home' : '/role'} />;
}
