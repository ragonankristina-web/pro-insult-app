import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '../../components/AuthScreen';
import { DevLogin } from '../../components/DevLogin';
import { Icon } from '../../components/Icon';
import { initials } from '../../components/Shell';
import { Button, Field, Grad, Notice } from '../../components/ui';
import { useAuth } from '../../lib/Auth';
import { devLoginEnabled, isDevPhone } from '../../lib/dev';
import { useLinks } from '../../lib/links';
import { roleInfo, type Link, type Role } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

// Кому можно отправить запрос — подсказка под полем номера.
const linkHint: Record<Role, string> = {
  patient: 'Номер лечащего врача (#врач-…) или близкого, который помогает (#ухаж-…)',
  caregiver: 'Номер пациента, за которым вы ухаживаете (#пац-…)',
  doctor: 'Номер пациента (#пац-…)',
};

function phoneText(phone: string | undefined) {
  const d = phone ?? '';
  return d.length === 11 ? `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : d;
}

// Профиль: личный номер, связи с врачом / пациентом / ухаживающим, выход. Открывается по аватару.
export default function Profile() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, session, signOut } = useAuth();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const { links, loading, request, respond, remove } = useLinks(Boolean(profile));
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.magenta} size="large" />
      </View>
    );
  }
  const info = roleInfo[profile.role];

  const copy = async () => {
    await Clipboard.setStringAsync(profile.personal_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async () => {
    if (!number.trim()) return setMsg({ tone: 'error', text: 'Введите номер' });
    setBusy(true);
    setMsg(null);
    const res = await request(number);
    setBusy(false);
    if ('error' in res && res.error) return setMsg({ tone: 'error', text: res.error });
    setNumber('');
    setMsg({ tone: 'ok', text: `Запрос отправлен${res.name ? `: ${res.name}` : ''}. Связь появится, когда его подтвердят.` });
  };

  const incoming = links.filter((l) => l.status === 'pending' && l.incoming);
  const outgoing = links.filter((l) => l.status === 'pending' && !l.incoming);
  const accepted = links.filter((l) => l.status === 'accepted');

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <View style={styles.topline}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            hitSlop={8}
            style={[styles.back, { backgroundColor: c.pink2 }]}
          >
            <Icon name="back" color={c.pinkInk} size={22} />
          </Pressable>
          <View style={[styles.avatar, { backgroundColor: c.blueSoft }]}>
            <Text style={[styles.avatarText, { color: c.profileInk }]}>{initials(profile.full_name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{profile.full_name || 'Без имени'}</Text>
            <Text style={[styles.sub, { color: c.inkMute }]} numberOfLines={1}>{`${info.title} · ${phoneText(session?.user.phone)}`}</Text>
          </View>
          <ThemeToggle />
        </View>

        {welcome ? <Notice tone="ok">Аккаунт создан. Добро пожаловать! Ниже — ваш личный номер.</Notice> : null}

        <Grad style={[styles.numberCard, { shadowColor: c.shadow }]}>
          <Text style={[styles.numLabel, { color: c.onGrad }]}>ВАШ ЛИЧНЫЙ НОМЕР</Text>
          <Text style={[styles.number, { color: c.onGrad }]} selectable accessibilityLabel={`Личный номер ${profile.personal_number}`}>
            {profile.personal_number}
          </Text>
          <Text style={[styles.numAbout, { color: c.onGrad }]}>
            {profile.role === 'doctor'
              ? 'Сообщите номер пациентам — они отправят вам запрос на ведение.'
              : profile.role === 'patient'
                ? 'Сообщите номер близкому, который помогает вам, — он сможет подключиться.'
                : 'По этому номеру вас узнают пациент и его врач.'}
          </Text>
          <Pressable onPress={copy} accessibilityRole="button" style={styles.copyBtn}>
            <Icon name={copied ? 'check' : 'copy'} color="#4E1764" size={18} />
            <Text style={styles.copyText}>{copied ? 'Скопировано' : 'Скопировать номер'}</Text>
          </Pressable>
        </Grad>

        <View style={[styles.card, { backgroundColor: c.pink }]}>
          <Text style={[styles.cardTitle, { color: c.ink }]}>Связаться по номеру</Text>
          <Field
            label="Номер человека"
            icon="link"
            value={number}
            onChangeText={(t) => {
              setNumber(t);
              setMsg(null);
            }}
            placeholder={profile.role === 'patient' ? '#врач-0001' : '#пац-0001'}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={send}
            hint={linkHint[profile.role]}
          />
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button title="Отправить запрос" onPress={send} loading={busy} />
        </View>

        {loading ? <ActivityIndicator color={c.magenta} /> : null}

        {incoming.length ? (
          <Section title="Входящие запросы">
            {incoming.map((l) => (
              <LinkRow key={l.id} l={l} note="хочет связаться с вами">
                <View style={styles.rowBtns}>
                  <Button title="Принять" onPress={() => respond(l.id, true)} style={{ flex: 1 }} />
                  <Button title="Отклонить" variant="soft" onPress={() => respond(l.id, false)} style={{ flex: 1 }} />
                </View>
              </LinkRow>
            ))}
          </Section>
        ) : null}

        <Section title="Мои связи">
          {!loading && !accepted.length ? (
            <Text style={[styles.empty, { color: c.inkMute }]}>Пока никого. Отправьте запрос по номеру выше.</Text>
          ) : null}
          {accepted.map((l) => (
            <LinkRow key={l.id} l={l} note="связь подтверждена">
              <Button title="Отвязать" variant="text" onPress={() => remove(l.id)} style={{ alignSelf: 'flex-start' }} />
            </LinkRow>
          ))}
        </Section>

        {outgoing.length ? (
          <Section title="Ждут подтверждения">
            {outgoing.map((l) => (
              <LinkRow key={l.id} l={l} note="запрос отправлен">
                <Button title="Отменить запрос" variant="text" onPress={() => remove(l.id)} style={{ alignSelf: 'flex-start' }} />
              </LinkRow>
            ))}
          </Section>
        ) : null}

        {devLoginEnabled && isDevPhone(session?.user.phone) ? <DevLogin current={profile.role} /> : null}

        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
          accessibilityRole="button"
          style={[styles.logout, { borderColor: c.line }]}
        >
          <Icon name="logout" color={c.inkSoft} size={20} />
          <Text style={[styles.logoutText, { color: c.inkSoft }]}>Выйти из аккаунта</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.section, { color: c.ink }]} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function LinkRow({ l, note, children }: { l: Link; note: string; children?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.rowHead}>
        <View style={[styles.rowAva, { backgroundColor: c.pink }]}>
          <Text style={[styles.rowAvaText, { color: c.pinkInk }]}>{initials(l.other_name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={1}>{l.other_name || 'Без имени'}</Text>
          <Text style={[styles.rowMeta, { color: c.inkMute }]} numberOfLines={2}>
            {`${roleInfo[l.other_role].title} · ${l.other_number} · ${note}`}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { flexGrow: 1, paddingHorizontal: 18 },
  inner: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.head700, fontSize: 16 },
  name: { fontFamily: fonts.head700, fontSize: 18 },
  sub: { fontFamily: fonts.body500, fontSize: 13, marginTop: 2 },
  numberCard: { borderRadius: radius.l, padding: 22, gap: 8, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 1,
    shadowRadius: 30, elevation: 6 },
  numLabel: { fontFamily: fonts.body700, fontSize: 12, letterSpacing: 1.6, opacity: 0.85 },
  number: { fontFamily: fonts.head700, fontSize: 40, letterSpacing: 0.5 },
  numAbout: { fontFamily: fonts.body500, fontSize: 14, lineHeight: 20, opacity: 0.92 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFFFFF',
    borderRadius: radius.pill, paddingHorizontal: 18, minHeight: 46, marginTop: 6 },
  copyText: { fontFamily: fonts.head700, fontSize: 15, color: '#4E1764' },
  card: { borderRadius: radius.m, padding: 16, gap: 14 },
  cardTitle: { fontFamily: fonts.head700, fontSize: 18 },
  section: { fontFamily: fonts.head700, fontSize: 17, marginTop: 4 },
  empty: { fontFamily: fonts.body500, fontSize: 14 },
  row: { borderWidth: 1, borderRadius: radius.m, padding: 14, gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowAva: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowAvaText: { fontFamily: fonts.head700, fontSize: 14 },
  rowName: { fontFamily: fonts.body700, fontSize: 16 },
  rowMeta: { fontFamily: fonts.body500, fontSize: 13, marginTop: 2 },
  rowBtns: { flexDirection: 'row', gap: 10 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderWidth: 1.5,
    borderRadius: radius.pill, marginTop: 8 },
  logoutText: { fontFamily: fonts.body700, fontSize: 15 },
});
