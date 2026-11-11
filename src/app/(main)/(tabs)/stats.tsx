import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { initials, PageHeader, TabScreen } from '../../../components/Shell';
import { Grad, Notice } from '../../../components/ui';
import { useAuth } from '../../../lib/Auth';
import { shortName, summary, useClinic } from '../../../lib/clinic';
import { perDay } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Вкладка врача «Статистика»: мои пациенты плиткой (те же, что в чатах). По нажатию — показатели пациента.
export default function Stats() {
  const { c } = useTheme();
  const { profile } = useAuth();
  const clinic = useClinic();
  if (profile && profile.role !== 'doctor') return <Redirect href="/home" />;

  return (
    <TabScreen header={<PageHeader title="Мои пациенты" />}>
      {clinic.demo ? (
        <Notice tone="info">Пока у вас нет подтверждённых пациентов — показан пример.</Notice>
      ) : null}
      {clinic.loading && !clinic.patients.length ? <ActivityIndicator color={c.magenta} /> : null}
      <View style={styles.grid}>
        {clinic.patients.map((p) => {
          const s = summary(p);
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/patient/[id]', params: { id: p.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}: занятий за неделю ${s.weekDone} из ${perDay * 7}. Открыть показатели`}
              style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Grad style={styles.square}>
                <Text style={styles.ini}>{initials(p.name)}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{`${s.growth >= 0 ? '+' : ''}${s.growth}`}</Text>
                </View>
              </Grad>
              <Text style={[styles.name, { color: c.ink }]} numberOfLines={2}>{shortName(p.name)}</Text>
              <Text style={[styles.sub, { color: c.inkMute }]}>{`${s.weekDone} из ${perDay * 7} за нед.`}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: c.inkMute }]}>
        Число на плитке — рост средней оценки (моторика, речь, мышление) с начала реабилитации.
      </Text>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: '3.5%', rowGap: 16 },
  tile: { width: '31%', alignItems: 'center' },
  square: { width: '100%', aspectRatio: 1, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center' },
  ini: { color: '#fff', fontFamily: fonts.head700, fontSize: 26 },
  badge: { position: 'absolute', right: 7, bottom: 7, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 99,
    paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#4E1764', fontFamily: fonts.body700, fontSize: 11.5 },
  name: { fontFamily: fonts.body700, fontSize: 13, textAlign: 'center', marginTop: 7, lineHeight: 17 },
  sub: { fontFamily: fonts.body500, fontSize: 11.5, textAlign: 'center', marginTop: 1 },
  note: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 18 },
});
