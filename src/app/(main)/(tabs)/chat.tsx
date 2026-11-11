import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useBrainy } from '../../../components/Brainy';
import { Icon } from '../../../components/Icon';
import { initials, PageHeader, Sect, TabScreen, Topline } from '../../../components/Shell';
import { Grad, Notice } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { DOCTOR_THREAD, useChat } from '../../../lib/chat';
import { useClinic } from '../../../lib/clinic';
import { addDays, hm, sameDay, today } from '../../../lib/dates';
import { lastScores, scoreParts } from '../../../lib/demo';
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
      {sub === 'chat' ? <Thread thread={DOCTOR_THREAD} other={other} placeholder="Сообщение врачу" /> : <Stats />}
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

// Время сообщения: сегодня — часы, вчера — «вчера», раньше — дата.
function when(at?: number) {
  if (!at) return '';
  const d = new Date(at);
  if (sameDay(d, today())) return hm(d);
  if (sameDay(d, addDays(today(), -1))) return 'вчера';
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Thread({ thread, other, placeholder }: { thread: string; other: string; placeholder: string }) {
  const { c } = useTheme();
  const chat = useChat();
  const brainy = useBrainy();
  const messages = chat.messages(thread);
  const [text, setText] = useState('');
  const { markRead } = chat;
  useEffect(() => markRead(thread), [markRead, thread]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    chat.add(thread, { mine: true, text: t });
    setText('');
  };
  return (
    <>
      <View style={{ gap: 9 }}>
        {messages.map((m, i) =>
          m.mine ? (
            <Grad key={i} style={[styles.bub, styles.me]}>
              <Text style={[styles.nm, { color: '#fff' }]}>{m.voice ? 'Вы · 🎙 надиктовано' : 'Вы'}</Text>
              <Text style={[styles.bubText, { color: '#fff' }]}>{m.text}</Text>
              {m.at ? <Text style={[styles.time, { color: '#fff' }]}>{when(m.at)}</Text> : null}
            </Grad>
          ) : (
            <View key={i} style={[styles.bub, styles.them, { backgroundColor: c.pink }]}>
              <Text style={[styles.nm, { color: c.pinkInk }]}>{other}</Text>
              <Text style={[styles.bubText, { color: c.ink }]}>{m.text}</Text>
              {m.at ? <Text style={[styles.time, { color: c.pinkInk }]}>{when(m.at)}</Text> : null}
            </View>
          ),
        )}
      </View>
      <View style={styles.composer}>
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
        <Pressable onPress={brainy.dictate} accessibilityRole="button" accessibilityLabel="Надиктовать сообщение Брэйни">
          <View style={[styles.sendBtn, styles.micBtn, { backgroundColor: c.pink2 }]}><Icon name="mic" color={c.pinkInk} size={20} /></View>
        </Pressable>
        <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="Отправить">
          <Grad style={styles.sendBtn}><Icon name="send" color="#fff" size={20} /></Grad>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: c.inkMute }]}>Переписка пока демонстрационная и не сохраняется.</Text>
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
                <Text style={[styles.rowTime, { color: unread ? c.magenta : c.inkMute }]}>{when(last?.at)}</Text>
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
  time: { fontFamily: fonts.body500, fontSize: 11, opacity: 0.7, marginTop: 4, alignSelf: 'flex-end' },
  subTab: { flex: 1, minHeight: 50, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7 },
  subText: { fontFamily: fonts.head700, fontSize: 15 },
  badge: { width: 9, height: 9, borderRadius: 5 },
  bub: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 },
  me: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  them: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  nm: { fontFamily: fonts.body700, fontSize: 11.5, opacity: 0.8, marginBottom: 3 },
  bubText: { fontFamily: fonts.body500, fontSize: 15, lineHeight: 21 },
  composer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, minWidth: 0, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 50,
    fontFamily: fonts.body500, fontSize: 15, outlineWidth: 0 },
  sendBtn: { width: 54, height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 50 },
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
