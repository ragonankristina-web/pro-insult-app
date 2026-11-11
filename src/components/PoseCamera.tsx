import { StyleSheet, Text, View } from 'react-native';

import type { PoseFrame } from '../lib/rtmpose';
import { fonts, radius } from '../theme/tokens';

// Камера с захватом движений (RTMPose). В приложении на телефоне модели пока нет — понадобится отдельная сборка;
// в браузере работает PoseCamera.web.tsx.

export type PoseCameraProps = {
  onPose: (f: PoseFrame | null) => void; // null — человека в кадре не видно
  frameColor?: string; // тонкая рамка: серая, зелёная, жёлтая
  label?: string; // подпись внизу, когда человек найден
  aspect?: number;
  skeleton?: boolean; // рисовать точки и линии поверх видео
};

export const poseCameraSupported = false;

export function PoseCamera({ aspect = 4 / 3 }: PoseCameraProps) {
  return (
    <View style={[styles.wrap, { aspectRatio: aspect }]}>
      <Text style={styles.text}>Захват движений пока работает в браузерной версии (Chrome, Edge).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.s, backgroundColor: '#1B1420', alignItems: 'center', justifyContent: 'center',
    padding: 20 },
  text: { color: '#fff', fontFamily: fonts.body600, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
