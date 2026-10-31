import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

// Элементы интерфейса в стиле макета: градиентные кнопки-«таблетки», розовые карточки,
// крупные поля ввода (у пациентов могут быть нарушения зрения и мелкой моторики).

export function Grad({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <LinearGradient colors={[c.g1, c.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'grad',
  style,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'grad' | 'soft' | 'text';
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const off = disabled || loading;
  const label =
    variant === 'grad' ? c.onGrad : variant === 'soft' ? c.pinkInk : c.magenta;
  const content = loading ? (
    <ActivityIndicator color={label} />
  ) : (
    <Text style={[s.btnText, variant === 'text' && s.btnTextSmall, { color: label }]}>{title}</Text>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {variant === 'grad' ? (
        <Grad style={[s.btn, s.btnShadow, { shadowColor: c.shadow }]}>{content}</Grad>
      ) : (
        <View style={[variant === 'soft' ? [s.btn, { backgroundColor: c.pink2 }] : s.textBtn]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  secure,
  icon,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string; secure?: boolean; icon?: IconName }) {
  const { c } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focus, setFocus] = useState(false);
  const border = error ? c.error : focus ? c.magenta : c.line;
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.inkSoft }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: c.surface, borderColor: border }]}>
        {icon ? <Icon name={icon} color={c.inkMute} size={20} /> : null}
        <TextInput
          {...input}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocus(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={c.inkMute}
          accessibilityLabel={label}
          style={[s.input, { color: c.ink }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Показать пароль' : 'Скрыть пароль'}
            hitSlop={8}
            style={s.eye}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} color={c.inkMute} size={20} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[s.error, { color: c.error }]} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={[s.hint, { color: c.inkMute }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// Ввод кода из письма: 6 клеток, под ними одно невидимое поле (вставка кода из буфера тоже работает).
export function CodeInput({ value, onChange, length = 6, error }: { value: string; onChange: (v: string) => void; length?: number; error?: boolean }) {
  const { c } = useTheme();
  const ref = useRef<TextInputInstance>(null);
  const [focus, setFocus] = useState(true);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Код из письма" style={s.codeRow}>
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] ?? '';
        const active = focus && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            style={[
              s.codeCell,
              { backgroundColor: c.surface, borderColor: error ? c.error : active ? c.magenta : ch ? c.plum : c.line },
            ]}
          >
            <Text style={[s.codeChar, { color: c.ink }]}>{ch}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={length}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={s.codeHidden}
        accessibilityLabel="Код из письма"
      />
    </Pressable>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const { c } = useTheme();
  const bg = tone === 'error' ? c.errorBg : tone === 'ok' ? c.okBg : c.pink2;
  const fg = tone === 'error' ? c.error : tone === 'ok' ? c.ok : c.pinkInk;
  return (
    <View style={[s.notice, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Text style={[s.noticeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={s.check}
    >
      <View style={[s.box, { borderColor: checked ? c.magenta : c.line, backgroundColor: checked ? c.magenta : c.surface }]}>
        {checked ? <Icon name="check" color="#fff" size={16} /> : null}
      </View>
      <Text style={[s.checkText, { color: c.inkSoft }]}>{children}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  btn: { minHeight: 58, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnShadow: { shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 22, elevation: 4 },
  btnText: { fontFamily: fonts.head700, fontSize: 17, letterSpacing: 0.2 },
  btnTextSmall: { fontSize: 15 },
  textBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  field: { gap: 6 },
  label: { fontFamily: fonts.body700, fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderWidth: 1.5,
    borderRadius: radius.s, paddingHorizontal: 14 },
  // outlineWidth: 0 — убирает рамку фокуса браузера; фокус и так виден по цвету рамки поля.
  input: { flex: 1, minWidth: 0, fontFamily: fonts.body500, fontSize: 16, paddingVertical: 14, outlineWidth: 0 },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.body600, fontSize: 13 },
  hint: { fontFamily: fonts.body500, fontSize: 13 },
  codeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  codeCell: { flex: 1, maxWidth: 54, aspectRatio: 0.82, borderWidth: 2, borderRadius: radius.s, alignItems: 'center',
    justifyContent: 'center' },
  codeChar: { fontFamily: fonts.head700, fontSize: 26 },
  codeHidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  notice: { borderRadius: radius.s, paddingHorizontal: 14, paddingVertical: 12 },
  noticeText: { fontFamily: fonts.body600, fontSize: 14, lineHeight: 20 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { flex: 1, fontFamily: fonts.body500, fontSize: 14, lineHeight: 20 },
});
