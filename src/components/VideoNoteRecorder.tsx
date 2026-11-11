import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

// Запись видеокружка. В приложении на телефоне — позже (нужна отдельная сборка с записью видео);
// в браузере работает VideoNoteRecorder.web.tsx. Смотреть присланные кружки можно и на телефоне.

export type VideoNoteRecorderProps = {
  onClose: () => void;
  onSend: (blob: Blob, mime: string, seconds: number) => Promise<string | null>; // текст ошибки или null
};

export function VideoNoteRecorder({ onClose }: VideoNoteRecorderProps) {
  const { c } = useTheme();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.back}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.text, { color: c.ink }]}>
            Видеокружки пока записываются в браузерной версии (Chrome, Edge, Safari). Смотреть их можно и здесь.
          </Text>
          <Button title="Понятно" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(20,13,25,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.m, padding: 20, gap: 16 },
  text: { fontFamily: fonts.body600, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
