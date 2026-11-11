import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandCamera, handCameraSupported, type Side } from '../../../components/HandCamera';
import { BackHeader } from '../../../components/Shell';
import { react } from '../../../lib/brainyMood';
import { Button, Checkbox } from '../../../components/ui';
import { useVoice } from '../../../components/useVoice';
import { findWake } from '../../../lib/brainy';
import {
  basketFromSpeech, basketImg, choose, fruitInfo, levels, makeRound, miss, needsSwap, pipeImg, swapSlots, type Round,
} from '../../../lib/fruitGame';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

const native = Platform.OS !== 'web';
const praise = ['Верно!', 'Отлично, в свою корзину!', 'Так держать!'];
type Phase = 'intro' | 'play' | 'paused' | 'done';

// «Фруктовый сад»: фрукт выпадает из трубы — выберите корзину с такой же картинкой.
// Выбор — нажатием (и клавишами 1–4, ← → в браузере), голосом (номер корзины) или поднятой рукой перед камерой.
export default function FruitGarden() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [round, setRound] = useState<Round>(() => makeRound(0));
  const [phase, setPhase] = useState<Phase>('intro');
  const [busy, setBusy] = useState(false);
  const [calm, setCalm] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [handsOn, setHandsOn] = useState(false);
  const [feedback, setFeedback] = useState('Выберите корзину с таким же фруктом.');
  const [flash, setFlash] = useState<{ slot: number; ok: boolean } | null>(null);
  const [passed, setPassed] = useState<number[]>([]);
  const [fall] = useState(() => new Animated.Value(0)); // падение в режиме «на время», 0…1
  const [fly] = useState(() => new Animated.Value(0)); // фрукт улетает в корзину
  const [shake] = useState(() => new Animated.Value(0));
  const token = useRef(0); // отменяет отложенные действия при смене уровня

  const level = levels[round.level];
  const fruit = round.queue[round.position];
  const count = round.slots.length;

  const setup = useCallback((i: number) => {
    token.current++;
    fall.setValue(0);
    fly.setValue(0);
    setRound(makeRound(i));
    setPhase('intro');
    setBusy(false);
    setFlash(null);
    setFeedback('Выберите корзину с таким же фруктом.');
  }, [fall, fly]);

  const advance = useCallback((r: Round, t: number) => {
    if (t !== token.current) return;
    setBusy(false);
    fall.setValue(0);
    fly.setValue(0);
    setFlash(null);
    if (r.position >= r.queue.length) {
      setRound(r);
      setPhase('done');
      react('happy');
      setPassed((p) => (p.includes(r.level) ? p : [...p, r.level]));
      return;
    }
    if (needsSwap(r)) {
      setRound(swapSlots(r));
      setFeedback('Корзины поменялись местами. Посмотрите на картинки.');
    } else {
      setRound(r);
    }
  }, [fall, fly]);

  // Выбор корзины любым способом. true — выбор принят (идёт игра и такая корзина есть).
  const pick = (slot: number) => {
    if (phase !== 'play' || busy || slot < 0 || slot >= count) return false;
    const { round: next, ok } = choose(round, slot);
    setFlash({ slot, ok });
    if (!ok) {
      setRound(next);
      setFeedback('Это другая корзина. Посмотрите на фрукт и попробуйте ещё раз.');
      react('sad');
      Animated.sequence(
        [8, -8, 6, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: native })),
      ).start();
      const t = token.current;
      setTimeout(() => t === token.current && setFlash(null), 400);
      return true;
    }
    setRound(next);
    setBusy(true);
    setFeedback(praise[next.correct % 3]);
    react('happy');
    Animated.timing(fly, { toValue: 1, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: native }).start();
    const t = token.current;
    setTimeout(() => advance(next, t), 320);
    return true;
  };

  // Режим «на время»: фрукт падает за время уровня; не успели — пропуск. При паузе падение замирает.
  useEffect(() => {
    if (phase !== 'play' || calm || busy) return;
    let cancelled = false;
    fall.stopAnimation((v) => {
      Animated.timing(fall, { toValue: 1, duration: level.seconds * 1000 * (1 - v), easing: Easing.linear,
        useNativeDriver: native }).start(({ finished }) => {
        if (!finished || cancelled) return;
        setFeedback('Фрукт пропущен. Следующий уже здесь — можно включить спокойный режим.');
        react('angry'); // в шутку сердится на убежавший фрукт
        advance(miss(round), token.current);
      });
    });
    return () => {
      cancelled = true;
      fall.stopAnimation();
    };
  }, [phase, calm, busy, round, level.seconds, fall, advance]);

  // Клавиатура в браузере: 1–4, ← первая корзина, → последняя, Esc — пауза.
  useEffect(() => {
    if (native) return;
    const onKey = (e: KeyboardEvent) => {
      let slot = -1;
      if (e.key === 'ArrowLeft') slot = 0;
      if (e.key === 'ArrowRight') slot = count - 1;
      if (/^[1-4]$/.test(e.key)) slot = Number(e.key) - 1;
      if (slot >= 0 && pick(slot)) e.preventDefault();
      if (e.key === 'Escape' && phase === 'play') setPhase('paused');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const voice = useVoice(voiceOn, (text) => {
    if (findWake(text)) return true; // фраза для Брэйни («Брэйни, напомни через два часа»), не выбор корзины
    const n = basketFromSpeech(text, count);
    return n >= 0 && pick(n);
  });
  const onRaise = (side: Side) => {
    if (pick(side === 'left' ? 0 : count - 1)) setFeedback((f) => `${side === 'left' ? 'Левая' : 'Правая'} рука. ${f}`);
  };

  const translateY = Animated.add(
    fall.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
    fly.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }),
  );
  const accuracy = round.attempts ? Math.round((round.correct / round.attempts) * 100) : 0;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}
    >
      <View style={styles.inner}>
        <BackHeader title="Фруктовый сад" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levels}>
          {levels.map((l, i) => {
            const on = i === round.level;
            return (
              <Pressable
                key={l.name}
                onPress={() => setup(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.level, { backgroundColor: on ? c.magenta : c.surface, borderColor: on ? c.magenta : c.line }]}
              >
                <Text style={[styles.levelText, { color: on ? c.onGrad : c.inkSoft }]}>
                  {`${i + 1}. ${l.name}${passed.includes(i) ? ' ✓' : ''}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.board, { backgroundColor: c.pink2, borderColor: c.line }]}>
          <View style={styles.boardTop}>
            <Text style={[styles.boardText, { color: c.inkSoft }]}>{level.name}</Text>
            <Text style={[styles.boardText, { color: c.inkSoft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.body700 }}>{Math.min(round.position, round.queue.length)}</Text>
              {` / ${round.queue.length} фруктов`}
            </Text>
          </View>

          <View style={styles.track}>
            <Image source={pipeImg} style={styles.pipe} resizeMode="stretch" />
            {fruit ? (
              <Animated.View
                accessibilityLabel={`Фрукт: ${fruitInfo[fruit].single}`}
                style={[styles.fruit, {
                  opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [{ translateX: shake }, { translateY },
                    { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }],
                }]}
              >
                <Image source={fruitInfo[fruit].img} style={styles.fill} resizeMode="contain" />
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.baskets}>
            {round.slots.map((t, i) => {
              const glow = flash?.slot === i ? (flash.ok ? '#2FD27A' : '#E5534B') : 'transparent';
              return (
                <Pressable
                  key={t}
                  onPress={() => pick(i)}
                  disabled={phase !== 'play' || busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${fruitInfo[t].name}, корзина ${i + 1}`}
                  style={({ pressed }) => [styles.basket, { borderColor: glow, transform: [{ translateY: pressed ? -3 : 0 }] }]}
                >
                  <View style={styles.basketArt}>
                    <Image source={basketImg} style={styles.fill} resizeMode="contain" />
                    <View style={styles.badge}>
                      <Image source={fruitInfo[t].img} style={styles.fill} resizeMode="contain" />
                    </View>
                  </View>
                  <View style={[styles.num, { backgroundColor: c.magenta }]}>
                    <Text style={[styles.numText, { color: c.onGrad }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.basketName, { color: c.ink }]} numberOfLines={1}>{fruitInfo[t].name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.feedback, { color: c.pinkInk }]} accessibilityLiveRegion="polite">{feedback}</Text>

          {phase !== 'play' ? (
            <View style={[styles.overlay, { backgroundColor: c.bg + 'EE' }]}>
              {phase === 'intro' ? (
                <>
                  <View style={styles.hero}>
                    {level.types.map((t) => <Image key={t} source={fruitInfo[t].img} style={styles.heroFruit} resizeMode="contain" />)}
                  </View>
                  <Text style={[styles.ovTitle, { color: c.ink }]}>{level.name}</Text>
                  <Text style={[styles.ovText, { color: c.inkSoft }]}>
                    {`${round.queue.length} фруктов, ${count} ${count === 4 ? 'корзинки' : 'корзины'}.`}
                    {level.swap ? ' Корзины будут иногда меняться местами — следите за картинками.' : ''}
                    {'\nВыберите корзину с таким же фруктом.'}
                  </Text>
                  <Button title="Начать уровень →" onPress={() => setPhase('play')} />
                </>
              ) : phase === 'paused' ? (
                <>
                  <Text style={[styles.ovTitle, { color: c.ink }]}>Небольшой перерыв</Text>
                  <Text style={[styles.ovText, { color: c.inkSoft }]}>Время остановлено. Продолжайте, когда будете готовы.</Text>
                  <Button title="Продолжить →" onPress={() => setPhase('play')} />
                </>
              ) : (
                <>
                  <Text style={[styles.ovTitle, { color: c.ink }]}>
                    {round.correct === round.queue.length ? 'Урожай собран!' : 'Уровень завершён'}
                  </Text>
                  <View style={styles.results}>
                    <Result value={`${round.correct}/${round.queue.length}`} label="собрано" />
                    <Result value={`${accuracy}%`} label="точность" />
                    <Result value={`${round.wrong}`} label="ошибок" />
                  </View>
                  {round.level < levels.length - 1 ? (
                    <Button title="Следующий уровень →" onPress={() => setup(round.level + 1)} />
                  ) : (
                    <Text style={[styles.ovText, { color: c.inkSoft }]}>Вы прошли все шесть уровней!</Text>
                  )}
                  <Button title="Повторить" variant="soft" onPress={() => setup(round.level)} />
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.row}>
          <Toggle on={voiceOn} disabled={!voice.supported} onPress={() => setVoiceOn((v) => !v)} label="🎙 Голос" />
          <Toggle on={handsOn} disabled={!handCameraSupported} onPress={() => setHandsOn((v) => !v)} label="✋ Руки" />
          <Toggle on={false} disabled={phase !== 'play'} onPress={() => setPhase('paused')} label="Ⅱ Пауза" />
        </View>

        {voiceOn ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.cardText, { color: c.ink }]}>
              {voice.denied
                ? 'Нет доступа к микрофону — разрешите его в настройках браузера.'
                : `Скажите номер корзины: «один», «два»${count > 2 ? ', «три»' : ''}${count > 3 ? ', «четыре»' : ''} — или «левая», «правая».`}
            </Text>
            {voice.heard ? <Text style={[styles.heard, { color: c.inkMute }]}>{`Услышано: «${voice.heard}»`}</Text> : null}
          </View>
        ) : null}
        {handsOn ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.cardText, { color: c.ink }]}>
              {`Поднимите левую руку — корзина 1, правую — корзина ${count}. Опустите руку перед следующим выбором.`}
            </Text>
            <HandCamera onRaise={onRaise} />
          </View>
        ) : null}
        {native ? (
          <Text style={[styles.note, { color: c.inkMute }]}>
            Выбор голосом и рукой пока работает в браузерной версии.
          </Text>
        ) : !voice.supported ? (
          <Text style={[styles.note, { color: c.inkMute }]}>Голос в этом браузере не поддерживается — откройте в Chrome или Edge.</Text>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Stat label="Правильно" value={round.correct} />
          <Stat label="Ошибки выбора" value={round.wrong} />
          <Stat label="Пропущено" value={round.missed} />
          <View style={[styles.progress, { backgroundColor: c.pink2 }]}>
            <View style={{ width: `${(round.position / round.queue.length) * 100}%`, height: '100%', backgroundColor: c.magenta }} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Checkbox checked={calm} onChange={setCalm}>
            {calm
              ? 'Спокойный режим: фрукт ждёт вашего выбора, без спешки.'
              : `Спокойный режим выключен: на один фрукт — ${level.seconds} сек.`}
          </Checkbox>
        </View>
      </View>
    </ScrollView>
  );
}

function Toggle({ on, disabled, onPress, label }: { on: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={[styles.toggle, { backgroundColor: on ? c.magenta : c.surface, borderColor: on ? c.magenta : c.line,
        opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={[styles.toggleText, { color: on ? c.onGrad : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { borderBottomColor: c.line }]}>
      <Text style={[styles.statLabel, { color: c.inkMute }]}>{label}</Text>
      <Text style={[styles.statValue, { color: c.ink }]}>{value}</Text>
    </View>
  );
}

function Result({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.resValue, { color: c.heroNum }]}>{value}</Text>
      <Text style={[styles.resLabel, { color: c.inkMute }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  levels: { gap: 8 },
  level: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  levelText: { fontFamily: fonts.body700, fontSize: 13 },
  board: { borderWidth: 1.5, borderRadius: radius.m, overflow: 'hidden', minHeight: 470 },
  boardTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14 },
  boardText: { fontFamily: fonts.body500, fontSize: 13 },
  track: { height: 230, alignItems: 'center' },
  pipe: { position: 'absolute', top: -70, width: 110, height: 155, zIndex: 3 },
  fruit: { position: 'absolute', top: 92, width: 92, height: 100, zIndex: 2 },
  fill: { width: '100%', height: '100%' },
  baskets: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingHorizontal: 12 },
  basket: { flex: 1, maxWidth: 170, alignItems: 'center', borderWidth: 3, borderRadius: 18, paddingVertical: 4 },
  basketArt: { width: '100%', aspectRatio: 506 / 620 },
  badge: { position: 'absolute', left: '32%', right: '32%', top: '52%', aspectRatio: 1, backgroundColor: '#FFF5DF',
    borderWidth: 2, borderColor: '#83532D', borderRadius: 12, padding: 4 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
  numText: { fontFamily: fonts.head700, fontSize: 16 },
  basketName: { fontFamily: fonts.body700, fontSize: 13, marginTop: 3 },
  feedback: { fontFamily: fonts.body600, fontSize: 14, textAlign: 'center', paddingHorizontal: 18, paddingVertical: 12,
    minHeight: 46 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 5, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  hero: { flexDirection: 'row', gap: 6 },
  heroFruit: { width: 70, height: 76 },
  ovTitle: { fontFamily: fonts.head700, fontSize: 24, textAlign: 'center' },
  ovText: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 380 },
  results: { flexDirection: 'row', gap: 22, marginVertical: 4 },
  resValue: { fontFamily: fonts.head700, fontSize: 24, fontVariant: ['tabular-nums'] },
  resLabel: { fontFamily: fonts.body500, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  toggle: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontFamily: fonts.body700, fontSize: 14 },
  card: { borderWidth: 1.5, borderRadius: radius.m, padding: 14, gap: 10 },
  cardText: { fontFamily: fonts.body600, fontSize: 14, lineHeight: 20 },
  heard: { fontFamily: fonts.body500, fontSize: 13 },
  note: { fontFamily: fonts.body500, fontSize: 12.5, textAlign: 'center' },
  stat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
    borderBottomWidth: 1 },
  statLabel: { fontFamily: fonts.body500, fontSize: 13.5 },
  statValue: { fontFamily: fonts.head700, fontSize: 19, fontVariant: ['tabular-nums'] },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
});
