import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useBrainy } from './Brainy';
import { BRAINY_RATIO, BrainyAvatar } from './BrainyAvatar';
import { stageOff, stageOn } from '../lib/brainyMood';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

// Место под Брэйни посередине экрана: занимает свободное место (flex: 1) и, если его хватает,
// показывает большого Брэйни. Пока он стоит здесь, маленький Брэйни в углу прячется (без двойника).
// Места мало (маленький экран, длинный список) — ничего не рисует, Брэйни остаётся в углу.

const MIN = 170; // меньше — Брэйни не поместится крупно, оставляем его в углу

// share — какую долю ширины места может занять Брэйни; hint — подпись под ним.
export function BrainyStage({ share = 0.85, hint = true }: { share?: number; hint?: boolean }) {
  const { c } = useTheme();
  const brainy = useBrainy();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fits = box.h >= MIN;

  // Считаемся «на экране», только пока экран открыт (под открытым сверху экраном — нет).
  useFocusEffect(
    useCallback(() => {
      if (!fits) return;
      stageOn();
      return stageOff;
    }, [fits]),
  );

  // Заполняет свободное место: по высоте (минус подпись) и не шире 85% экрана и 380 px.
  const width = Math.min(380, box.w * share, (box.h - (hint ? 30 : 4)) / BRAINY_RATIO);
  return (
    <View
      style={styles.stage}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox((b) => (Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
      }}
    >
      {fits ? (
        <Pressable
          onPress={brainy.show}
          accessibilityRole="button"
          accessibilityLabel="Брэйни — нажмите, чтобы спросить"
          style={({ pressed }) => [styles.press, { opacity: pressed ? 0.85 : 1 }]}
        >
          <BrainyAvatar width={width} />
          {hint ? <Text style={[styles.hint, { color: c.inkMute }]}>Нажмите на меня или скажите «Брэйни»</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  press: { alignItems: 'center' },
  hint: { fontFamily: fonts.body600, fontSize: 12.5, marginTop: 2, textAlign: 'center' },
  spot: { position: 'absolute', zIndex: 5, alignItems: 'center', justifyContent: 'center' },
});

// Брэйни поверх карточки, в её свободной части: ничего не раздвигает и не смещает (position: absolute).
// style — прямоугольник свободного места внутри родителя (родитель — карточка с position: relative).
export function BrainySpot({ style }: { style: StyleProp<ViewStyle> }) {
  const brainy = useBrainy();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const width = Math.min(240, box.w, box.h / BRAINY_RATIO);
  const fits = width >= 70;

  useFocusEffect(
    useCallback(() => {
      if (!fits) return;
      stageOn();
      return stageOff;
    }, [fits]),
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.spot, style]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox((b) => (Math.abs(b.w - w) < 1 && Math.abs(b.h - h) < 1 ? b : { w, h }));
      }}
    >
      {fits ? (
        <Pressable
          onPress={brainy.show}
          accessibilityRole="button"
          accessibilityLabel="Брэйни — нажмите, чтобы спросить"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <BrainyAvatar width={width} />
        </Pressable>
      ) : null}
    </View>
  );
}
