import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { ThemeToggle } from './AuthScreen';
import { Icon, type IconName } from './Icon';
import { Grad, Notice } from './ui';

// Каркас разделов из макета: нижнее меню на 4 вкладки, верхняя строка с профилем,
// ассистент «Брэйни» и короткие подсказки о том, что появится позже.

export function initials(name: string) {
  return (name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

// ── подсказка «скоро» ─────────────────────────────────────
const SoonContext = createContext<(text: string) => void>(() => {});
export const useSoon = () => useContext(SoonContext);

export function SoonProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 2600);
  }, []);
  return (
    <SoonContext.Provider value={show}>
      {children}
      {text ? (
        <View pointerEvents="none" style={styles.toast}>
          <View style={styles.toastInner}>
            <Notice tone="info">{text}</Notice>
          </View>
        </View>
      ) : null}
    </SoonContext.Provider>
  );
}

// ── нижнее меню ───────────────────────────────────────────
const tabs: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главный', icon: 'home' },
  { id: 'lessons', label: 'Занятия', icon: 'list' },
  { id: 'chat', label: 'Чат и\nпоказатели', icon: 'chat' },
  { id: 'shop', label: 'Покупки', icon: 'bag' },
];

export function TabBar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  return (
    <View style={[styles.nav, { backgroundColor: c.surface, borderTopColor: c.line, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.navInner} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = path === `/${t.id}`;
          const body = (
            <>
              <Icon name={t.icon} color={on ? c.onGrad : c.inkMute} size={22} />
              <Text style={[styles.navText, { color: on ? c.onGrad : c.inkMute }]}>{t.label}</Text>
            </>
          );
          return (
            <Pressable
              key={t.id}
              onPress={() => !on && router.push(`/${t.id}` as never)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label.replace('\n', ' ')}
              style={styles.navItem}
            >
              {on ? <Grad style={styles.navCell}>{body}</Grad> : <View style={styles.navCell}>{body}</View>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── экран вкладки ─────────────────────────────────────────
export function TabScreen({
  children,
  header,
  overlay,
  contentStyle,
}: {
  children: ReactNode;
  header?: ReactNode; // закреплено над прокруткой (верхняя строка, переключатель)
  overlay?: ReactNode; // поверх прокрутки (ассистент)
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      {header ? <View style={styles.wrap}>{header}</View> : null}
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.wrap, styles.content, contentStyle]}>{children}</View>
        </ScrollView>
        {overlay ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="box-none" style={[styles.wrap, { flex: 1 }]}>{overlay}</View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── верхняя строка с профилем ─────────────────────────────
export function Topline({ name, sub }: { name: string; sub: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.topline}>
      <Pressable
        onPress={() => router.push('/profile')}
        accessibilityRole="button"
        accessibilityLabel="Профиль и личный номер"
        style={[styles.profile, { backgroundColor: c.blueSoft, shadowColor: c.blue }]}
      >
        <Text style={[styles.profileText, { color: c.profileInk }]}>{initials(name)}</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.who, { color: c.ink }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.whoSub, { color: c.inkMute }]} numberOfLines={1}>{sub}</Text>
      </View>
      <ThemeToggle />
    </View>
  );
}

// ── ассистент «Брэйни» ────────────────────────────────────
export function AiDot({ floating }: { floating?: boolean }) {
  const { c } = useTheme();
  const soon = useSoon();
  return (
    <Pressable
      onPress={() => soon('Здесь откроется голосовой ассистент «Брэйни».')}
      accessibilityRole="button"
      accessibilityLabel="Голосовой ассистент Брэйни"
      style={[styles.aiWrap, floating && styles.aiFloating]}
    >
      <View style={[styles.aiRing, { borderColor: c.magenta }]} />
      <Grad style={[styles.aiDot, { shadowColor: c.shadow }]}>
        <Text style={styles.aiFace}>🙂</Text>
      </Grad>
      <Text style={[styles.aiName, { color: c.inkMute }]}>Брэйни</Text>
    </Pressable>
  );
}

export function AiRail() {
  const soon = useSoon();
  const say = () => soon('Здесь откроется голосовой ассистент «Брэйни».');
  return (
    <Grad style={styles.rail}>
      <View style={styles.railFace}><Text style={{ fontSize: 19 }}>🙂</Text></View>
      <Pressable onPress={say} accessibilityRole="button" accessibilityLabel="Говорить с Брэйни" style={styles.railBtn}>
        <Icon name="mic" color="#fff" size={18} />
      </Pressable>
      <Pressable onPress={() => soon('Брэйни подскажет, как выполнять упражнение.')} accessibilityRole="button"
        accessibilityLabel="Подсказка" style={styles.railBtn}>
        <Icon name="help" color="#fff" size={18} />
      </Pressable>
      <Text style={styles.railVert}>БРЭЙНИ</Text>
    </Grad>
  );
}

// ── заголовок вкладки без профиля: название и переключатель темы ──
export function PageHeader({ title }: { title: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.pageHead}>
      <Text style={[styles.pageTitle, { color: c.ink }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <ThemeToggle />
    </View>
  );
}

// ── заголовок экрана без нижнего меню: «назад», название, тема ──
export function BackHeader({ title }: { title: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.pageHead}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        accessibilityRole="button"
        accessibilityLabel="Назад"
        hitSlop={8}
        style={[styles.backBtn, { backgroundColor: c.pink2 }]}
      >
        <Icon name="back" color={c.pinkInk} size={22} />
      </Pressable>
      <Text style={[styles.pageTitle, { color: c.ink }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <ThemeToggle />
    </View>
  );
}

// ── общий заголовок раздела ───────────────────────────────
export function Sect({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[styles.sect, { color: c.ink }]} accessibilityRole="header">{children}</Text>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18 },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, gap: 14, paddingTop: 6, paddingBottom: 24 },
  toast: { position: 'absolute', left: 0, right: 0, bottom: 104, alignItems: 'center', paddingHorizontal: 18 },
  toastInner: { width: '100%', maxWidth: 460 },
  nav: { borderTopWidth: 1, paddingTop: 9, paddingHorizontal: 12 },
  navInner: { flexDirection: 'row', gap: 4, width: '100%', maxWidth: 520, alignSelf: 'center' },
  navItem: { flex: 1 },
  navCell: { minHeight: 58, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingVertical: 6, paddingHorizontal: 2 },
  navText: { fontFamily: fonts.body700, fontSize: 11.5, textAlign: 'center', lineHeight: 14 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingBottom: 8 },
  profile: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 3 },
  profileText: { fontFamily: fonts.head700, fontSize: 16 },
  who: { fontFamily: fonts.head700, fontSize: 17 },
  whoSub: { fontFamily: fonts.body500, fontSize: 13, marginTop: 2 },
  aiWrap: { width: 78, height: 96, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  aiFloating: { position: 'absolute', right: 14, bottom: 8 },
  aiRing: { position: 'absolute', top: -3, width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderStyle: 'dashed',
    opacity: 0.55 },
  aiDot: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 20, elevation: 5 },
  aiFace: { fontSize: 28 },
  aiName: { fontFamily: fonts.body700, fontSize: 11, marginTop: 7 },
  rail: { position: 'absolute', right: -18, top: 8, bottom: 16, width: 58, borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22, alignItems: 'center', gap: 14, paddingVertical: 16 },
  railFace: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center',
    justifyContent: 'center' },
  railBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center',
    justifyContent: 'center' },
  railVert: { marginTop: 'auto', color: '#fff', fontFamily: fonts.body700, fontSize: 11, letterSpacing: 2, opacity: 0.85,
    transform: [{ rotate: '-90deg' }], width: 80, textAlign: 'center', marginBottom: 30 },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingBottom: 8, minHeight: 58 },
  pageTitle: { flex: 1, fontFamily: fonts.head700, fontSize: 21 },
  backBtn: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sect: { fontFamily: fonts.head700, fontSize: 17, marginTop: 6 },
});
