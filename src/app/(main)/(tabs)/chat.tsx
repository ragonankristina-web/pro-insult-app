import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useBrainy } from '../../../components/Brainy';
import { Icon } from '../../../components/Icon';
import { VideoNote } from '../../../components/VideoNote';
import { VideoNoteRecorder } from '../../../components/VideoNoteRecorder';
import { initials, PageHeader, Sect, TabScreen, Topline } from '../../../components/Shell';
import { Grad, Notice } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { useChat } from '../../../lib/chat';
import { useClinic } from '../../../lib/clinic';
import { addDays, hm, monthsOf, sameDay, today } from '../../../lib/dates';
import { lastScores, scoreParts, type Message } from '../../../lib/demo';
import { usePeople } from '../../../lib/people';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

type Sub = 'chat' | 'stats';

// Пациент и ухаживающий: чат с врачом и показатели, из которых строится график прогресса.
// Врач: список чатов с пациентами, как в мессенджере, и переписка с выбранным.
export default function ChatTab() {
  const { profile } = useAuth();
  return profile?.role === 'doctor' ? <DoctorChats /> : <ChatAndStats />;
}

function ChatAndStats() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const people = usePeople();
  const chat = useChat();
  const params = useLocalSearchParams<{ sub?: string }>();
  const sub: Sub = params.sub === 'stats' ? 'stats' : 'chat';
  const setSub = (s: Sub) => router.setParams({ sub: s });

  // Собеседник — лечащий врач. Без связи — врач из макета.
  const other = (people.doctor?.other_name ?? 'Ирина Соколова') + ', невролог';

  return (
    <TabScreen
      header={
        <>
          <Topline name={profile?.full_name || 'Без имени'} sub={other} />
          <View style={styles.tabs2} accessibilityRole="tablist">
            <SubTab on={sub === 'chat'} color={c.plumDeep} onPress={() => setSub('chat')} badge>Чат</SubTab>
            <SubTab on={sub === 'stats'} color={c.blue} onPress={() => setSub('stats')}>Показатели</SubTab>
          </View>
        </>
      }
    >
      {sub === 'chat' ? (
        <>
          {!chat.isReal(chat.doctorThread) && !people.loading ? (
            <Notice tone="info">
              Врач ещё не привязан — показан пример переписки. Привяжите врача по его номеру (#врач-…) в профиле.
            </Notice>
          ) : null}
          <Thread thread={chat.doctorThread} other={other} placeholder="Сообщение врачу" />
        </>
      ) : (
        <Stats />
      )}
    </TabScreen>
  );
}

function SubTab({ on, color, onPress, badge, children }: { on: boolean; color: string; onPress: () => void; badge?: boolean; children: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[styles.subTab, { backgroundColor: on ? color : c.pink2 }]}
    >
      {badge ? <View style={[styles.badge, { backgroundColor: on ? '#fff' : c.magenta }]} /> : null}
      <Text style={[styles.subText, { color: on ? '#fff' : c.pinkInk }]}>{children}</Text>
    </Pressable>
  );
}

// Время в списке чатов: сегодня — часы, вчера — «вчера», раньше — дата.
function lastWhen(at?: number) {
  if (!at) return '';
  const d = new Date(at);
  if (sameDay(d, today())) return hm(d);
  if (sameDay(d, addDays(today(), -1))) return 'вчера';
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Время под сообщением — часы; день показан разделителем над сообщениями.
const when = (at?: number) => (at ? hm(new Date(at)) : '');

function dayLabel(at: number) {
  const d = new Date(at);
  if (sameDay(d, today())) return 'Сегодня';
  if (sameDay(d, addDays(today(), -1))) return 'Вчера';
  return `${d.getDate()} ${monthsOf[d.getMonth()]}`;
}

function Thread({ thread, other, placeholder }: { thread: string; other: string; placeholder: string }) {
  const { c } = useTheme();
  const chat = useChat();
  const brainy = useBrainy();
  const messages = chat.messages(thread);
  const [text, setText] = useState('');
  const real = chat.isReal(thread);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<'voice' | 'video'>('voice');
  const [recording, setRecording] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null); // своё сообщение, по которому нажали
  const [confirm, setConfirm] = useState(false); // «удалить?» — второй шаг меню
  const [editing, setEditing] = useState<Message | null>(null); // исправляем это сообщение
  const { markRead } = chat;
  // Открыли переписку (или пришло новое сообщение, пока она открыта) — отмечаем прочитанным.
  useEffect(() => {
    markRead(thread);
  }, [markRead, thread]);
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const err = editing ? await chat.edit(thread, editing.id, t) : await chat.add(thread, { mine: true, text: t });
    setSending(false);
    setFailed(err);
    if (!err) {
      setText('');
      setEditing(null);
    }
  };
  const closeMenu = () => {
    setMenu(null);
    setConfirm(false);
  };
  const startEdit = (m: Message) => {
    closeMenu();
    setEditing(m);
    setText(m.text);
  };
  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };
  const removeIt = async (m: Message) => {
    closeMenu();
    if (editing?.id === m.id) cancelEdit();
    setFailed(await chat.remove(thread, m.id));
  };
  return (
    <>
      {real && !chat.ready ? <ActivityIndicator color={c.magenta} /> : null}
      {real && chat.ready && !messages.length ? (
        <Text style={[styles.empty, { color: c.inkMute }]}>Сообщений пока нет — напишите первым.</Text>
      ) : null}
      {chat.error && real ? <Notice tone="error">{chat.error}</Notice> : null}
      {/* Как в Telegram: свои сообщения — справа, собеседника — слева; между днями — дата. */}
      <View style={[styles.room, { backgroundColor: c.pink2 }]} accessibilityLabel={`Переписка: ${other}`}>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const day = m.at ? dayLabel(m.at) : '';
          const newDay = Boolean(day) && (!prev?.at || dayLabel(prev.at) !== day);
          const sameSide = prev && prev.mine === m.mine && !newDay;
          const meta = `${m.voice ? '🎙 ' : ''}${m.edited ? 'изменено · ' : ''}${when(m.at)}${m.mine && real ? (m.read ? '  ✓✓' : '  ✓') : ''}`;
          return (
            <View key={i}>
              {newDay ? (
                <View style={styles.dayWrap}>
                  <Text style={[styles.day, { backgroundColor: c.surface, color: c.inkSoft }]}>{day}</Text>
                </View>
              ) : null}
              <View
                style={[styles.line, { justifyContent: m.mine ? 'flex-end' : 'flex-start', marginTop: sameSide ? 3 : 10 }]}
                accessibilityLabel={`${m.mine ? 'Вы' : other}: ${m.text}${m.mine && real && m.read ? ', прочитано' : ''}`}
              >
                {m.video ? (
                  <>
                    {m.mine ? (
                      // У кружка нажатие включает звук — меню открываем отдельной кнопкой.
                      <Pressable onPress={() => setMenu(m)} accessibilityRole="button" accessibilityLabel="Действия с видеокружком"
                        hitSlop={8} style={[styles.more, { backgroundColor: c.surface }]}>
                        <Text style={[styles.moreText, { color: c.inkSoft }]}>⋯</Text>
                      </Pressable>
                    ) : null}
                    <VideoNote video={m.video} mine={m.mine} meta={meta.replace('🎙 ', '')} />
                  </>
                ) : m.mine ? (
                  // Нажатие на своё сообщение — меню «Изменить / Удалить».
                  <Pressable
                    onPress={() => setMenu(m)}
                    accessibilityRole="button"
                    accessibilityHint="Открыть действия: изменить или удалить"
                    style={({ pressed }) => [styles.bubWrap, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Grad style={[styles.bub, styles.me, styles.full, editing?.id === m.id && styles.editingBub]}>
                      <Text style={[styles.bubText, { color: '#fff' }]}>{m.text}</Text>
                      {meta.trim() ? <Text style={[styles.meta, { color: 'rgba(255,255,255,0.85)' }]}>{meta}</Text> : null}
                    </Grad>
                  </Pressable>
                ) : (
                  <View style={[styles.bub, styles.them, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Text style={[styles.bubText, { color: c.ink }]}>{m.text}</Text>
                    {meta.trim() ? <Text style={[styles.meta, { color: c.inkMute }]}>{meta}</Text> : null}
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {!messages.length ? <View style={{ height: 40 }} /> : null}
      </View>
      {editing ? (
        <View style={[styles.editBar, { backgroundColor: c.surface, borderColor: c.magenta }]}>
          <Text style={[styles.editTitle, { color: c.magenta }]}>✏️ Изменение сообщения</Text>
          <Text style={[styles.editText, { color: c.inkSoft }]} numberOfLines={1}>{editing.text}</Text>
          <Pressable onPress={cancelEdit} accessibilityRole="button" accessibilityLabel="Отменить изменение" hitSlop={10}
            style={styles.editClose}>
            <Icon name="close" color={c.inkMute} size={18} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        {/* Переключатель, как в Telegram: голос (Брэйни) ↔ видеокружок. */}
        <View style={[styles.modes, { backgroundColor: c.pink2 }]} accessibilityRole="radiogroup" accessibilityLabel="Голос или видеокружок">
          {(['voice', 'video'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setMode(k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === k }}
              accessibilityLabel={k === 'voice' ? 'Голосом через Брэйни' : 'Видеокружок'}
              style={[styles.modeBtn, mode === k && { backgroundColor: c.surface }]}
            >
              <Icon name={k === 'voice' ? 'mic' : 'circle'} color={mode === k ? c.magenta : c.pinkInk} size={19} />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={placeholder}
          placeholderTextColor={c.inkMute}
          accessibilityLabel={placeholder}
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
          returnKeyType="send"
        />
        {text.trim() ? (
          <Pressable onPress={send} disabled={sending} accessibilityRole="button"
            accessibilityLabel={editing ? 'Сохранить исправление' : 'Отправить'} accessibilityState={{ busy: sending }}>
            <Grad style={[styles.sendBtn, sending && { opacity: 0.6 }]}>
              <Icon name={editing ? 'check' : 'send'} color="#fff" size={20} />
            </Grad>
          </Pressable>
        ) : (
          // Поле пустое — кнопка делает то, что выбрано переключателем: диктовка Брэйни или видеокружок.
          <Pressable
            onPress={mode === 'voice' ? brainy.dictate : () => setRecording(true)}
            accessibilityRole="button"
            accessibilityLabel={mode === 'voice' ? 'Надиктовать сообщение Брэйни' : 'Записать видеокружок'}
          >
            <Grad style={styles.sendBtn}><Icon name={mode === 'voice' ? 'mic' : 'circle'} color="#fff" size={22} /></Grad>
          </Pressable>
        )}
      </View>
      {menu ? (
        <Modal transparent animationType="fade" onRequestClose={closeMenu}>
          <Pressable style={styles.menuBack} onPress={closeMenu} accessibilityLabel="Закрыть меню">
            <Pressable style={[styles.menu, { backgroundColor: c.surface }]} onPress={() => {}}>
              <Text style={[styles.menuText, { color: c.ink }]} numberOfLines={3}>{menu.video ? '🎥 Видеокружок' : menu.text}</Text>
              {confirm ? (
                <>
                  <Text style={[styles.menuAsk, { color: c.inkSoft }]}>
                    Удалить сообщение? Оно исчезнет и у вас, и у собеседника.
                  </Text>
                  <Pressable onPress={() => removeIt(menu)} accessibilityRole="button"
                    style={[styles.menuBtn, { backgroundColor: c.errorBg }]}>
                    <Text style={[styles.menuBtnText, { color: c.error }]}>Удалить</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {!menu.video ? (
                    <Pressable onPress={() => startEdit(menu)} accessibilityRole="button"
                      style={[styles.menuBtn, { backgroundColor: c.pink2 }]}>
                      <Text style={[styles.menuBtnText, { color: c.pinkInk }]}>✏️  Изменить</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setConfirm(true)} accessibilityRole="button"
                    style={[styles.menuBtn, { backgroundColor: c.errorBg }]}>
                    <Text style={[styles.menuBtnText, { color: c.error }]}>🗑  Удалить</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={closeMenu} accessibilityRole="button" style={styles.menuBtn}>
                <Text style={[styles.menuBtnText, { color: c.inkSoft }]}>Отмена</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {recording ? (
        <VideoNoteRecorder onClose={() => setRecording(false)} onSend={(blob, mime, sec) => chat.sendVideo(thread, blob, mime, sec)} />
      ) : null}
      {failed ? <Notice tone="error">{failed}</Notice> : null}
      <Text style={[styles.note, { color: c.inkMute }]}>
        {real
          ? 'Переписку видите только вы и собеседник. Новые сообщения приходят сразу.'
          : 'Это пример переписки — он не сохраняется.'}
      </Text>
    </>
  );
}

// ── врач: все чаты с пациентами ──────────────────────────
function DoctorChats() {
  const { c } = useTheme();
  const clinic = useClinic();
  const chat = useChat();
  const params = useLocalSearchParams<{ with?: string }>();
  const open = params.with ? clinic.patient(params.with) : undefined;

  if (open) {
    return (
      <TabScreen
        header={
          <View style={styles.threadHead}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.setParams({ with: undefined }))}
              accessibilityRole="button"
              accessibilityLabel="Все чаты"
              hitSlop={8}
              style={[styles.iconBtn, { backgroundColor: c.pink2 }]}
            >
              <Icon name="back" color={c.pinkInk} size={22} />
            </Pressable>
            <View style={[styles.ava, { backgroundColor: c.pink }]}>
              <Text style={[styles.avaText, { color: c.pinkInk }]}>{initials(open.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={1}>{open.name}</Text>
              <Text style={[styles.rowText, { color: c.inkMute }]}>{`${open.number} · ${open.week}-я неделя`}</Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/patient/[id]', params: { id: open.id } })}
              accessibilityRole="button"
              accessibilityLabel="Показатели пациента"
              hitSlop={8}
              style={[styles.iconBtn, { backgroundColor: c.pink2 }]}
            >
              <Icon name="stats" color={c.pinkInk} size={20} />
            </Pressable>
          </View>
        }
      >
        <Thread thread={open.id} other={open.name} placeholder="Сообщение пациенту" />
      </TabScreen>
    );
  }

  // Сверху — где есть новые сообщения, затем по времени последнего сообщения.
  const rows = clinic.patients
    .map((p) => {
      const list = chat.messages(p.id);
      return { p, last: list[list.length - 1], unread: chat.unread(p.id) };
    })
    .sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || (b.last?.at ?? 0) - (a.last?.at ?? 0));

  return (
    <TabScreen header={<PageHeader title="Чаты" />}>
      {clinic.demo ? (
        <Notice tone="info">Пока у вас нет подтверждённых пациентов — показан пример переписки.</Notice>
      ) : null}
      <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
        {rows.map(({ p, last, unread }, i) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/chat', params: { with: p.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${unread ? `, новых сообщений: ${unread}` : ''}`}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
              { backgroundColor: pressed ? c.pink2 : 'transparent' },
            ]}
          >
            <View style={[styles.ava, { backgroundColor: c.pink }]}>
              <Text style={[styles.avaText, { color: c.pinkInk }]}>{initials(p.name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={1}>{p.name}</Text>
                <Text style={[styles.rowTime, { color: unread ? c.magenta : c.inkMute }]}>{lastWhen(last?.at)}</Text>
              </View>
              <View style={styles.rowTop}>
                <Text style={[styles.rowText, { color: unread ? c.ink : c.inkMute }]} numberOfLines={1}>
                  {last ? `${last.mine ? 'Вы: ' : ''}${last.text}` : 'Нет сообщений'}
                </Text>
                {unread ? (
                  <View style={[styles.unread, { backgroundColor: c.magenta }]}>
                    <Text style={styles.unreadText}>{unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </TabScreen>
  );
}

function Stats() {
  const { c } = useTheme();
  return (
    <>
      <View style={[styles.card, { backgroundColor: c.pink }]}>
        <Text style={[styles.cardTitle, { color: c.ink }]}>Откуда берутся графики</Text>
        <Text style={[styles.cardText, { color: c.pinkInk }]}>
          Это оценки за выполненные блоки упражнений. Из них складывается линия прогресса на главном экране.
        </Text>
        {lastScores.map((s) => (
          <View key={s.metric} style={[styles.srow, { backgroundColor: c.surface }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.lab, { color: c.ink }]}>{s.title}</Text>
              <Text style={[styles.labSub, { color: c.inkMute }]}>{`последний блок · ${s.date}`}</Text>
            </View>
            <Text style={[styles.val, { color: c.heroNum }]}>{s.value}</Text>
          </View>
        ))}
      </View>

      <Sect>Из чего складывается оценка блока</Sect>
      <View style={[styles.card, { backgroundColor: c.pink2 }]}>
        {scoreParts.map((p) => (
          <View key={p.title} style={[styles.srow, styles.srowCol, { backgroundColor: c.surface }]}>
            <View style={styles.partHead}>
              <Text style={[styles.lab, { color: c.ink }]}>{p.title}</Text>
              <Text style={[styles.valSmall, { color: c.heroNum }]}>{p.value}</Text>
            </View>
            <View style={[styles.meter, { backgroundColor: c.pink2 }]}>
              <Grad style={{ width: `${p.share * 100}%`, height: '100%', borderRadius: radius.pill }} />
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.slot, { borderColor: c.line }]}>
        <Text style={[styles.slotTitle, { color: c.inkSoft }]}>Таблицы оценки</Text>
        <Text style={[styles.slotText, { color: c.inkMute }]}>
          Место под шкалы оценки от врачей. Сетка готова — подставим строки и баллы.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tabs2: { flexDirection: 'row', gap: 9, paddingBottom: 10 },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 10, minHeight: 58 },
  iconBtn: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1.5, borderRadius: radius.m, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 72 },
  ava: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontFamily: fonts.head700, fontSize: 15 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, fontFamily: fonts.body700, fontSize: 15 },
  rowTime: { fontFamily: fonts.body600, fontSize: 12 },
  rowText: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, marginTop: 3 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    marginTop: 3 },
  unreadText: { color: '#fff', fontFamily: fonts.body700, fontSize: 12 },
  empty: { fontFamily: fonts.body500, fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  subTab: { flex: 1, minHeight: 50, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7 },
  subText: { fontFamily: fonts.head700, fontSize: 15 },
  badge: { width: 9, height: 9, borderRadius: 5 },
  bubWrap: { maxWidth: '75%' },
  full: { maxWidth: '100%' },
  editingBub: { borderWidth: 2, borderColor: '#FFC93C' },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 6,
    alignSelf: 'center' },
  moreText: { fontFamily: fonts.body700, fontSize: 18, lineHeight: 20 },
  editBar: { borderLeftWidth: 4, borderRadius: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 40, marginTop: 4 },
  editTitle: { fontFamily: fonts.body700, fontSize: 13 },
  editText: { fontFamily: fonts.body500, fontSize: 13.5, marginTop: 2 },
  editClose: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  menuBack: { flex: 1, backgroundColor: 'rgba(20,13,25,0.5)', justifyContent: 'flex-end', alignItems: 'center', padding: 16 },
  menu: { width: '100%', maxWidth: 440, borderRadius: radius.m, padding: 14, gap: 8 },
  menuText: { fontFamily: fonts.body600, fontSize: 15, lineHeight: 21, paddingHorizontal: 4, paddingBottom: 4 },
  menuAsk: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  menuBtn: { minHeight: 52, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center' },
  menuBtnText: { fontFamily: fonts.body700, fontSize: 16 },
  room: { borderRadius: radius.m, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 12 },
  line: { flexDirection: 'row' },
  bub: { maxWidth: '75%', paddingHorizontal: 13, paddingTop: 9, paddingBottom: 6, borderRadius: 18 },
  me: { borderBottomRightRadius: 5 },
  them: { borderBottomLeftRadius: 5, borderWidth: 1 },
  meta: { fontFamily: fonts.body600, fontSize: 11, marginTop: 3, alignSelf: 'flex-end' },
  dayWrap: { alignItems: 'center', marginTop: 12 },
  day: { fontFamily: fonts.body700, fontSize: 12, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden' },
  bubText: { fontFamily: fonts.body500, fontSize: 15, lineHeight: 21 },
  composer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 50,
    fontFamily: fonts.body500, fontSize: 15, outlineWidth: 0 },
  sendBtn: { width: 54, height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, gap: 2, alignSelf: 'center' },
  modeBtn: { width: 40, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: fonts.body500, fontSize: 12 },
  card: { borderRadius: radius.m, padding: 14, gap: 7 },
  cardTitle: { fontFamily: fonts.head700, fontSize: 16 },
  cardText: { fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 19, marginBottom: 4 },
  srow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11 },
  srowCol: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  partHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lab: { fontFamily: fonts.body700, fontSize: 14 },
  labSub: { fontFamily: fonts.body500, fontSize: 12, marginTop: 2 },
  val: { fontFamily: fonts.head700, fontSize: 20, fontVariant: ['tabular-nums'] },
  valSmall: { fontFamily: fonts.head700, fontSize: 14 },
  meter: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  slot: { borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.m, paddingVertical: 20, paddingHorizontal: 14,
    alignItems: 'center', gap: 4 },
  slotTitle: { fontFamily: fonts.head700, fontSize: 15 },
  slotText: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
