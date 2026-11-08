import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useBrainy } from '../../../components/Brainy';
import { Icon } from '../../../components/Icon';
import { Sect, TabScreen, Topline } from '../../../components/Shell';
import { Grad } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { useChat } from '../../../lib/chat';
import { lastScores, scoreParts } from '../../../lib/demo';
import { usePeople } from '../../../lib/people';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

type Sub = 'chat' | 'stats';

// Чат с врачом (у врача — с пациентом) и показатели, из которых строится график прогресса.
export default function ChatAndStats() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const people = usePeople();
  const params = useLocalSearchParams<{ sub?: string }>();
  const sub: Sub = params.sub === 'stats' ? 'stats' : 'chat';
  const setSub = (s: Sub) => router.setParams({ sub: s });

  const doctor = profile?.role === 'doctor';
  // Собеседник: у врача — пациент, у остальных — лечащий врач. Без связи — человек из макета.
  const other = doctor
    ? (people.patients[0]?.other_name ?? 'Алексей Петрович') + ', пациент'
    : (people.doctor?.other_name ?? 'Ирина Соколова') + ', невролог';

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
      {sub === 'chat' ? <Chat other={other} doctor={doctor} /> : <Stats />}
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

function Chat({ other, doctor }: { other: string; doctor: boolean }) {
  const { c } = useTheme();
  const { messages, add } = useChat();
  const brainy = useBrainy();
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    add({ mine: true, text: t });
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
            </Grad>
          ) : (
            <View key={i} style={[styles.bub, styles.them, { backgroundColor: c.pink }]}>
              <Text style={[styles.nm, { color: c.pinkInk }]}>{other}</Text>
              <Text style={[styles.bubText, { color: c.ink }]}>{m.text}</Text>
            </View>
          ),
        )}
      </View>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={doctor ? 'Сообщение пациенту' : 'Сообщение врачу'}
          placeholderTextColor={c.inkMute}
          accessibilityLabel={doctor ? 'Сообщение пациенту' : 'Сообщение врачу'}
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
