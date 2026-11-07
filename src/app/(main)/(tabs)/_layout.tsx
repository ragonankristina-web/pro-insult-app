import { Slot } from 'expo-router';
import { View } from 'react-native';

import { SoonProvider, TabBar } from '../../../components/Shell';

// Четыре раздела из макета с общим нижним меню: Главный, Занятия, Чат и показатели, Покупки.
export default function TabsLayout() {
  return (
    <SoonProvider>
      <View style={{ flex: 1 }}>
        <Slot />
        <TabBar />
      </View>
    </SoonProvider>
  );
}
