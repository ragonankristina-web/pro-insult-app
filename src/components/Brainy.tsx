import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../lib/Auth';
import { findWake, isAgain, isNo, isYes, moodOf, parse, tidyMessage, whenText } from '../lib/brainy';
import { react, reacting, setTalking, touch, useStageActive } from '../lib/brainyMood';
import { aiTrouble, askBrainy, type Turn } from '../lib/brainyAi';
import { useChat } from '../lib/chat';
import { say, stopSaying, voiceName, warmUpVoice } from '../lib/voice';
import { sessionsOn, useClinic } from '../lib/clinic';
import { hm, today } from '../lib/dates';
import { lessonBlocks } from '../lib/demo';
import { speechExercises } from '../lib/exercises';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { BrainyAvatar } from './BrainyAvatar';
import { Icon } from './Icon';
import { Button, Checkbox, Grad } from './ui';
import { setVoiceMuted, useVoice } from './useVoice';

// Ассистент «Брэйни» поверх всех экранов: кнопка в углу и окно разговора.
// Отзывается на имя («Брэйни, открой речь»), открывает разделы, объясняет технику по карточкам упражнений,
// ставит напоминания и пишет в чат с врачом под диктовку — только после подтверждения пациента.

type Guide = { title: string; about: string; steps: string[]; path: string };

const guides: Record<string, Guide> = {
  ...Object.fromEntries(
    speechExercises.map((e) => [e.id, { title: e.title, about: e.about, steps: e.steps, path: `/speech/${e.id}` }]),
  ),
  fruit: {
    title: 'Фруктовый сад',
    about: '6 уровней · внимание и сортировка',
    steps: [
      'Из трубы падает фрукт.',
      'Выберите корзину с таким же фруктом: нажмите на неё или назовите её номер.',
      'Можно поднять руку: левая — первая корзина, правая — последняя.',
      'После выбора опустите руку.',
    ],
    path: '/think/fruit',
  },
};

const examples = [
  'Брэйни, открой упражнения для речи',
  'Брэйни, как делать трубочку?',
  'Брэйни, что на сегодня?',
  'Брэйни, напомни в 18:00 про занятия',
  'Брэйни, напиши врачу, что болит плечо',
  'Брэйни, назад',
];

type Card =
  | { kind: 'draft'; text: string }
  | { kind: 'emergency'; write: string }
  | { kind: 'guide'; id: string }
  | { kind: 'help' };

type Reminder = { id: number; at: number; what: string };

const tabPaths = ['/home', '/lessons', '/chat', '/stats', '/shop'];
const KEY_WAKE = 'brainy.wake';
const KEY_REMINDERS = 'brainy.reminders';

// dictate — надиктовать сообщение в чат; show — открыть окно Брэйни (например, по нажатию на большого Брэйни).
const BrainyContext = createContext<{ dictate: () => void; show: () => void }>({ dictate: () => {}, show: () => {} });
export const useBrainy = () => useContext(BrainyContext);

export function Brainy({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { profile } = useAuth();
  const chat = useChat();
  const clinic = useClinic();
  const doctor = profile?.role === 'doctor';
  const toWhom = doctor ? 'пациенту' : 'врачу';
  const stage = useStageActive();
  // Куда писать: у пациента — лечащему врачу; у врача — в открытый сейчас чат с пациентом.
  const params = useGlobalSearchParams<{ with?: string }>();
  const thread = doctor ? (path === '/chat' && typeof params.with === 'string' ? params.with : null) : chat.doctorThread;

  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('Здравствуйте! Я Брэйни. Чем помочь?');
  const [card, setCard] = useState<Card | null>(null);
  const [awaitMessage, setAwaitMessage] = useState(false);
  const [mic, setMic] = useState(false); // одна фраза без обращения по имени (нажали 🎙 или идёт разговор)
  const [history, setHistory] = useState<Turn[]>([]); // беседа: реплики пациента и Брэйни (последние 30)
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const [wake, setWake] = useState(false); // слушать обращение «Брэйни» постоянно
  const [input, setInput] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Любое действие в приложении — Брэйни не уснёт, а спящий проснётся.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, touch));
  }, []);

  // Настройки и напоминания переживают перезапуск приложения.
  useEffect(() => {
    AsyncStorage.multiGet([KEY_WAKE, KEY_REMINDERS])
      .then(([[, w], [, r]]) => {
        if (w === '1') setWake(true);
        if (r) setReminders(JSON.parse(r));
      })
      .catch(() => {});
  }, []);
  const saveWake = (on: boolean) => {
    setWake(on);
    AsyncStorage.setItem(KEY_WAKE, on ? '1' : '0').catch(() => {});
  };
  const saveReminders = useCallback((list: Reminder[]) => {
    setReminders(list);
    AsyncStorage.setItem(KEY_REMINDERS, JSON.stringify(list)).catch(() => {});
  }, []);

  // Говорит медленно — пациентам после инсульта так легче воспринимать. Пока говорит, микрофон не слушает.
  // В браузере — голосом «Руслан» (lib/voice.web.ts); вызов из нажатия заодно разрешает браузеру звук.
  // Пока говорит — анимация разговора; если в словах есть чувство («Отлично!», «Я не понял») — эта эмоция.
  const speak = useCallback((text: string, log = true) => {
    setReply(text);
    if (log) setHistory((h) => [...h, { role: 'assistant' as const, content: text }].slice(-30));
    warmUpVoice();
    setVoiceMuted(true);
    const felt = moodOf(text);
    if (felt && !reacting()) react(felt);
    setTalking(true);
    let done = false;
    const unmute = () => {
      if (done) return;
      done = true;
      setTalking(false);
      setTimeout(() => setVoiceMuted(false), 400);
    };
    setTimeout(unmute, 6000 + text.length * 110); // если голос так и не ответил
    say(text.replace(/[«»]/g, ''), unmute);
  }, []);

  // Напоминания: пока приложение открыто, проверяем раз в 15 секунд.
  useEffect(() => {
    if (!reminders.length) return;
    const id = setInterval(() => {
      const now = Date.now();
      const due = reminders.filter((r) => r.at <= now);
      if (!due.length) return;
      saveReminders(reminders.filter((r) => r.at > now));
      setOpen(true);
      setCard(null);
      speak(`Напоминаю: ${due.map((r) => r.what).join(', ')}.`);
    }, 15_000);
    return () => clearInterval(id);
  }, [reminders, saveReminders, speak]);

  const here = /^\/speech\/(.+)$/.exec(path)?.[1] ?? (path === '/think/fruit' ? 'fruit' : null);
  const go = (to: string) => {
    if (to !== path) router.push(to as never);
  };

  const noThread = () => {
    setCard(null);
    setAwaitMessage(false);
    speak('Сначала откройте чат с пациентом — тогда я напишу ему.');
    go('/chat');
  };
  const draft = (text: string) => {
    if (!thread) return noThread();
    const t = tidyMessage(text);
    setAwaitMessage(false);
    if (!t) return speak(`Что написать ${toWhom}? Говорите.`);
    setCard({ kind: 'draft', text: t });
    speak(`Я написал: ${t} Отправить?`);
  };
  const send = (text: string) => {
    const t = text.trim();
    if (!t || !thread) return;
    setCard(null);
    chat.add(thread, { mine: true, text: t, voice: true }).then((err) => {
      if (err) {
        setCard({ kind: 'draft', text: t });
        return speak(`Не получилось отправить. ${err}`);
      }
      speak(`Отправил ${toWhom}.`);
      setOpen(false);
      if (!doctor) go('/chat');
    });
  };
  const dictate = () => {
    setOpen(true);
    if (!thread) return noThread();
    setCard(null);
    setAwaitMessage(true);
    speak(`Что написать ${toWhom}? Говорите.`);
  };

  const handle = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setOpen(true);
    setHistory((h) => [...h, { role: 'user' as const, content: text }].slice(-30));
    // Брэйни сопереживает тому, что сказал пациент: радуется «спасибо», грустит от «мне плохо».
    const felt = moodOf(text);
    if (felt) react(felt);
    if (card?.kind === 'draft') {
      if (isYes(text)) return send(card.text);
      if (isNo(text)) {
        setCard(null);
        return speak('Не отправляю.');
      }
      if (isAgain(text)) {
        setCard(null);
        setAwaitMessage(true);
        return speak('Говорите заново.');
      }
    }
    if (awaitMessage) return draft(text);

    const it = parse(text);
    switch (it.kind) {
      case 'go':
        setCard(null);
        speak(`Открываю ${it.to.title}.`);
        setOpen(false);
        return go(it.to.path);
      case 'back':
        setOpen(false);
        return router.canGoBack() ? router.back() : router.replace('/home');
      case 'explain': {
        const id = it.id ?? here;
        if (!id || !guides[id]) {
          setCard({ kind: 'help' });
          return speak('Какое упражнение объяснить? Скажите, например: как делать трубочку.');
        }
        setCard({ kind: 'guide', id });
        return speak(`${guides[id].title}. ${guides[id].steps.join(' ')}`);
      }
      case 'write':
        if (it.text) return draft(it.text);
        if (!thread) return noThread();
        setCard(null);
        setAwaitMessage(true);
        return speak(`Что написать ${toWhom}? Говорите.`);
      case 'remind':
        saveReminders([...reminders, { id: it.at.getTime() + reminders.length, at: it.at.getTime(), what: it.what }].sort((a, b) => a.at - b.at));
        setCard(null);
        return speak(`Хорошо. Напомню ${whenText(it.at)}: ${it.what}.`);
      case 'remindAsk':
        setCard(null);
        return speak('Когда напомнить? Скажите, например: напомни в 18:00 или через 30 минут.');
      case 'today': {
        if (doctor) {
          const list = sessionsOn(clinic.sessions, today());
          setCard(null);
          return speak(
            list.length
              ? `Сегодня занятий: ${list.length}. Первое в ${hm(list[0].at)}: ${list[0].title}.`
              : 'Сегодня занятий нет.',
          );
        }
        const all = lessonBlocks.flatMap((b) => b.lessons);
        const left = all.filter((l) => !l.done);
        setCard(null);
        return speak(
          left.length
            ? `Сегодня в плане ${all.length} упражнений, осталось ${left.length}: ${left.slice(0, 3).map((l) => l.title).join(', ')}.`
            : 'Все упражнения на сегодня выполнены. Отличная работа!',
        );
      }
      case 'help':
        setCard({ kind: 'help' });
        return speak('Вот что я умею.');
      case 'stop':
        stopSaying();
        setCard(null);
        setHistory([]);
        return setOpen(false);
      case 'emergency':
        setCard({ kind: 'emergency', write: it.write });
        return speak('Если внезапно перекосило лицо, ослабли рука или нога или нарушилась речь — срочно звоните 103.');
      default:
        return converse(text);
    }
  };

  // Не команда — разговор: отвечает ИИ (GigaChat через функцию brainy-chat). После ответа Брэйни сам слушает
  // следующую фразу — можно продолжать без «Брэйни». ИИ не подключён — подсказывает, что умеет.
  const converse = async (text: string) => {
    setCard(null);
    setThinking(true);
    // ИИ получает последние реплики беседы (вместе с ответами на команды — так ему понятнее контекст).
    const turns: Turn[] = [...history, { role: 'user' as const, content: text }].slice(-12);
    const role = profile?.role;
    const ans = await askBrainy(turns, {
      name: (profile?.full_name ?? '').trim().split(/\s+/).slice(0, 2).join(' ') || undefined,
      role,
      week: role === 'patient' ? '4-я неделя' : undefined,
      left: role === 'doctor' ? undefined : lessonBlocks.flatMap((b) => b.lessons).filter((l) => !l.done).map((l) => l.title),
    });
    setThinking(false);
    if ('reply' in ans) {
      speak(ans.reply);
      if (voice.supported) setMic(true);
      return;
    }
    if (ans.error === 'off') {
      setCard({ kind: 'help' });
      return speak('Я не понял. Вот что я умею.');
    }
    speak(aiTrouble[ans.error]);
  };

  // Слушаем без обращения по имени не дольше 25 секунд тишины.
  useEffect(() => {
    if (!mic) return;
    const t = setTimeout(() => setMic(false), 25_000);
    return () => clearTimeout(t);
  }, [mic]);

  // Без обращения по имени слушаем, только когда Брэйни ждёт ответа: текст сообщения, «отправить» или нажат 🎙.
  const direct = mic || awaitMessage || card?.kind === 'draft';
  const voice = useVoice(wake || direct, (text, final) => {
    if (!final) return false;
    if (direct) {
      setMic(false);
      handle(findWake(text)?.command ?? text);
      return true;
    }
    const w = findWake(text);
    if (!w) return false;
    if (w.command) handle(w.command);
    else {
      setOpen(true);
      setMic(true);
      speak('Слушаю.');
    }
    return true;
  });

  const toggle = () => {
    if (open) {
      stopSaying();
      setOpen(false);
      setMic(false);
      setAwaitMessage(false);
      return;
    }
    setOpen(true);
    warmUpVoice();
    if (voice.supported) setMic(true);
  };
  const submit = () => {
    const t = input.trim();
    setInput('');
    if (t) handle(t);
  };

  const listening = voice.supported && !voice.denied && (direct || (wake && open));
  const status = thinking
    ? 'Думаю…'
    : !voice.supported
    ? 'Пишите вопрос ниже'
    : voice.denied
      ? 'Нет доступа к микрофону'
      : awaitMessage
        ? 'Слушаю сообщение…'
        : direct
          ? 'Слушаю…'
          : wake
            ? 'Обращайтесь: «Брэйни, …»'
            : 'Нажмите 🎙 и говорите';

  const base = insets.bottom + (tabPaths.includes(path) ? 90 : 16);
  const chips = [
    'Давай поболтаем',
    'Что на сегодня?',
    here ? 'Как делать это упражнение?' : 'Как делать трубочку?',
    `Написать ${toWhom}`,
    'Напомнить через 30 минут',
    'Что ты умеешь?',
  ];

  return (
    <BrainyContext.Provider value={{ dictate, show: () => !open && toggle() }}>
      <View style={{ flex: 1 }} onTouchStart={touch}>
        {children}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {open ? <Pressable onPress={toggle} accessibilityLabel="Закрыть Брэйни" style={styles.backdrop} /> : null}
          <View pointerEvents="box-none" style={styles.layer}>
            {open ? (
              <View
                style={[styles.panel, { bottom: base + 76, maxHeight: '78%', backgroundColor: c.surface, borderColor: c.line,
                  shadowColor: c.shadow }]}
                accessibilityViewIsModal
              >
                <View style={styles.head}>
                  <BrainyAvatar width={84} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.headName, { color: c.ink }]}>Брэйни</Text>
                    <Text style={[styles.headSub, { color: listening ? c.ok : c.inkMute }]} accessibilityLiveRegion="polite">
                      {listening ? '● ' : ''}{status}
                    </Text>
                  </View>
                  <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={8}
                    style={[styles.round, { backgroundColor: c.pink2 }]}>
                    <Icon name="close" color={c.pinkInk} size={20} />
                  </Pressable>
                </View>

                <ScrollView
                  ref={scroll}
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={styles.body}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
                >
                  {/* Беседа, как в мессенджере: Брэйни слева, вы справа. */}
                  {(history.length ? history : [{ role: 'assistant' as const, content: reply }]).map((t, i, all) =>
                    t.role === 'user' ? (
                      <View key={i} style={[styles.say, styles.mine, { backgroundColor: c.magenta }]}>
                        <Text style={[styles.sayText, { color: '#fff' }]}>{t.content}</Text>
                      </View>
                    ) : (
                      <View key={i} style={[styles.say, styles.his, { backgroundColor: c.pink2 }]}>
                        <Text style={[styles.sayText, { color: c.ink }]} accessibilityLiveRegion="polite">{t.content}</Text>
                        {i === all.length - 1 ? (
                          <Pressable onPress={() => speak(t.content, false)} accessibilityRole="button"
                            accessibilityLabel="Повторить вслух" hitSlop={6} style={styles.repeat}>
                            <Text style={{ fontSize: 16 }}>🔊</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ),
                  )}
                  {thinking ? (
                    <View style={[styles.say, styles.his, { backgroundColor: c.pink2 }]}>
                      <Text style={[styles.sayText, { color: c.inkMute }]}>Брэйни думает…</Text>
                    </View>
                  ) : null}
                  {listening && voice.heard ? (
                    <Text style={[styles.heard, { color: c.inkSoft }]}>{`Вы: «${voice.heard}»`}</Text>
                  ) : null}

                  {card?.kind === 'draft' ? (
                    <View style={[styles.card, { borderColor: c.magenta }]}>
                      <Text style={[styles.cardTitle, { color: c.ink }]}>{`Сообщение ${toWhom}`}</Text>
                      <TextInput
                        value={card.text}
                        onChangeText={(t) => setCard({ kind: 'draft', text: t })}
                        multiline
                        accessibilityLabel="Текст сообщения — можно исправить"
                        style={[styles.draft, { color: c.ink, backgroundColor: c.pink2 }]}
                      />
                      <View style={styles.row}>
                        <Button title="Отправить" onPress={() => send(card.text)} style={{ flex: 1 }} />
                        <Button title="Заново" variant="soft" onPress={() => handle('заново')} style={{ flex: 1 }} />
                      </View>
                      <Button title="Не отправлять" variant="text" onPress={() => handle('отмена')} />
                      <Text style={[styles.small, { color: c.inkMute }]}>
                        Скажите «отправить» или «отмена». Текст можно исправить пальцем.
                      </Text>
                    </View>
                  ) : null}

                  {card?.kind === 'emergency' ? (
                    <View style={[styles.card, { borderColor: c.error, backgroundColor: c.errorBg }]}>
                      <Text style={[styles.cardTitle, { color: c.error }]}>Это может быть срочно</Text>
                      <Text style={[styles.cardText, { color: c.ink }]}>
                        Внезапно перекосило лицо, ослабли рука или нога, нарушилась речь — звоните 103 сразу, не ждите
                        ответа врача в чате.
                      </Text>
                      <Button title="Позвонить 103" onPress={() => Linking.openURL('tel:103').catch(() => {})} />
                      <Button title="Позвонить 112" variant="soft" onPress={() => Linking.openURL('tel:112').catch(() => {})} />
                      {card.write ? (
                        <Button title={`Написать ${toWhom}`} variant="text" onPress={() => draft(card.write)} />
                      ) : null}
                    </View>
                  ) : null}

                  {card?.kind === 'guide' ? (
                    <View style={[styles.card, { borderColor: c.line }]}>
                      <Text style={[styles.cardTitle, { color: c.ink }]}>{guides[card.id].title}</Text>
                      <Text style={[styles.small, { color: c.inkMute }]}>{guides[card.id].about}</Text>
                      {guides[card.id].steps.map((s, i) => (
                        <View key={s} style={styles.step}>
                          <View style={[styles.stepNum, { backgroundColor: c.pink2 }]}>
                            <Text style={[styles.stepNumText, { color: c.pinkInk }]}>{i + 1}</Text>
                          </View>
                          <Text style={[styles.cardText, { color: c.ink, flex: 1 }]}>{s}</Text>
                        </View>
                      ))}
                      {guides[card.id].path !== path ? (
                        <Button title="Открыть упражнение" onPress={() => { setOpen(false); go(guides[card.id].path); }} />
                      ) : null}
                    </View>
                  ) : null}

                  {card?.kind === 'help' ? (
                    <View style={[styles.card, { borderColor: c.line }]}>
                      <Text style={[styles.cardTitle, { color: c.ink }]}>Можно сказать</Text>
                      {examples.map((e) => (
                        <Text key={e} style={[styles.cardText, { color: c.inkSoft }]}>{`«${e}»`}</Text>
                      ))}
                    </View>
                  ) : null}

                  {reminders.length ? (
                    <View style={{ gap: 6 }}>
                      <Text style={[styles.small, { color: c.inkMute }]}>Напоминания</Text>
                      {reminders.map((r) => (
                        <View key={r.id} style={[styles.reminder, { backgroundColor: c.pink2 }]}>
                          <Text style={[styles.cardText, { color: c.ink, flex: 1 }]}>
                            {`${whenText(new Date(r.at))} — ${r.what}`}
                          </Text>
                          <Pressable onPress={() => saveReminders(reminders.filter((x) => x.id !== r.id))}
                            accessibilityRole="button" accessibilityLabel="Удалить напоминание" hitSlop={8}>
                            <Icon name="close" color={c.inkMute} size={18} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.chips}>
                    {chips.map((t) => (
                      <Pressable key={t} onPress={() => handle(t)} accessibilityRole="button"
                        style={({ pressed }) => [styles.chip, { backgroundColor: c.pink2, opacity: pressed ? 0.8 : 1 }]}>
                        <Text style={[styles.chipText, { color: c.pinkInk }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.small, { color: c.inkMute }]}>{`Голос: ${voiceName}`}</Text>
                  {voice.supported ? (
                    <View style={{ gap: 4 }}>
                      <Checkbox checked={wake} onChange={saveWake}>Отзываться на имя «Брэйни»</Checkbox>
                      <Text style={[styles.small, { color: c.inkMute }]}>
                        Микрофон слушает, пока открыто приложение. В Chrome речь распознаётся на серверах Google.
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.small, { color: c.inkMute }]}>
                      Голосом Брэйни пока управляется в браузере Chrome или Edge. Здесь можно писать.
                    </Text>
                  )}
                </ScrollView>

                <View style={[styles.inputRow, { borderTopColor: c.line }]}>
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={submit}
                    placeholder={awaitMessage ? `Сообщение ${toWhom}` : 'Спросите Брэйни'}
                    placeholderTextColor={c.inkMute}
                    accessibilityLabel="Вопрос для Брэйни"
                    returnKeyType="send"
                    style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
                  />
                  {voice.supported ? (
                    <Pressable onPress={() => setMic((m) => !m)} accessibilityRole="button"
                      accessibilityLabel={mic ? 'Не слушать' : 'Говорить'} accessibilityState={{ selected: mic }}>
                      {mic ? (
                        <Grad style={styles.roundBig}><Icon name="mic" color="#fff" size={20} /></Grad>
                      ) : (
                        <View style={[styles.roundBig, { backgroundColor: c.pink2 }]}><Icon name="mic" color={c.pinkInk} size={20} /></View>
                      )}
                    </Pressable>
                  ) : null}
                  <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Спросить">
                    <Grad style={styles.roundBig}><Icon name="send" color="#fff" size={20} /></Grad>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Большой Брэйни стоит посередине экрана (BrainyStage) — в углу его не дублируем. */}
            {open || !stage ? (
              <Pressable
                onPress={toggle}
                accessibilityRole="button"
                accessibilityLabel={open ? 'Закрыть Брэйни' : 'Помощник Брэйни'}
                style={[styles.bubble, { bottom: base }]}
              >
                {open ? (
                  // Окно открыто — сам Брэйни в окне, здесь только «закрыть».
                  <Grad style={[styles.dot, { shadowColor: c.shadow }]}>
                    <Icon name="close" color="#fff" size={24} />
                  </Grad>
                ) : (
                  <>
                    <BrainyAvatar width={110} />
                    {wake || listening ? (
                      <View style={[styles.ear, { backgroundColor: c.ok, borderColor: c.surface }]}>
                        <Icon name="mic" color="#fff" size={11} />
                      </View>
                  ) : null}
                  <View style={[styles.name, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Text style={[styles.nameText, { color: c.inkSoft }]}>Брэйни</Text>
                  </View>
                </>
              )}
            </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </BrainyContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,13,25,0.28)' },
  layer: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  panel: { position: 'absolute', left: 12, right: 12, borderRadius: radius.m, borderWidth: 1, overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 }, shadowOpacity: 1, shadowRadius: 28, elevation: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  headName: { fontFamily: fonts.head700, fontSize: 17 },
  headSub: { fontFamily: fonts.body600, fontSize: 12.5, marginTop: 1 },
  round: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  say: { maxWidth: '86%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  his: { alignSelf: 'flex-start', borderBottomLeftRadius: 5, paddingRight: 38 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  sayText: { fontFamily: fonts.body600, fontSize: 16.5, lineHeight: 23 },
  repeat: { position: 'absolute', right: 8, top: 8 },
  heard: { fontFamily: fonts.body500, fontSize: 14, fontStyle: 'italic' },
  card: { borderWidth: 1.5, borderRadius: radius.s, padding: 14, gap: 9 },
  cardTitle: { fontFamily: fonts.head700, fontSize: 16 },
  cardText: { fontFamily: fonts.body500, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17 },
  draft: { fontFamily: fonts.body600, fontSize: 17, lineHeight: 24, borderRadius: 13, padding: 12, minHeight: 80,
    textAlignVertical: 'top', outlineWidth: 0 },
  row: { flexDirection: 'row', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.head700, fontSize: 13 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 9, minHeight: 40, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body700, fontSize: 13.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1 },
  input: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 48,
    fontFamily: fonts.body500, fontSize: 15, outlineWidth: 0 },
  roundBig: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bubble: { position: 'absolute', right: 6, width: 118, alignItems: 'center' },
  dot: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 18, elevation: 8 },
  ear: { position: 'absolute', top: 2, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: -6, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 1 },
  nameText: { fontFamily: fonts.body700, fontSize: 11 },
});
