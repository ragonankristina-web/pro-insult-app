import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CameraProps } from '../lib/exercises';
import { fonts, radius } from '../theme/tokens';

// Телефон: фронтальная камера. Распознавание мимики пока есть только в браузерной версии
// (PatientCamera.web.tsx); в приложении для него понадобится отдельная сборка с модулем распознавания.
export function PatientCamera({ judge, onVerdict }: CameraProps) {
  const [permission, request] = useCameraPermissions();

  useEffect(() => {
    if (judge) onVerdict({ state: 'idle', hint: 'Автопроверка пока работает в браузерной версии.' });
  }, [judge, onVerdict]);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.msg}>
        <Text style={styles.msgText}>Камера нужна, чтобы видеть, как вы выполняете упражнение. Видео не записывается.</Text>
        {permission.canAskAgain ? (
          <Pressable onPress={request} accessibilityRole="button" style={styles.btn}>
            <Text style={styles.btnText}>Разрешить камеру</Text>
          </Pressable>
        ) : (
          <Text style={styles.msgText}>Разрешите камеру в настройках телефона.</Text>
        )}
      </View>
    );
  }
  return <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />;
}

const styles = StyleSheet.create({
  msg: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  msgText: { color: '#fff', fontFamily: fonts.body600, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 20, minHeight: 48, justifyContent: 'center' },
  btnText: { color: '#4E1764', fontFamily: fonts.head700, fontSize: 15 },
});
