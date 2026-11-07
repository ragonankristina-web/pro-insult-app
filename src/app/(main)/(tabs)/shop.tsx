import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sect, TabScreen, useSoon } from '../../../components/Shell';
import { Grad } from '../../../components/ui';
import { doctors, features, partners } from '../../../lib/demo';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';

// Покупки: тариф, умные функции, выбор врача, партнёры и предложения.
export default function Shop() {
  const { c } = useTheme();
  const soon = useSoon();
  return (
    <TabScreen>
      <Grad style={styles.plan}>
        <Text style={styles.eyebrow}>ВАШ ТАРИФ</Text>
        <Text style={styles.planTitle}>Базовый</Text>
        <Text style={styles.planText}>
          Занятия по программе врача, дневник и чат. Умные функции и выбор специалиста — в расширенных тарифах.
        </Text>
        <Pressable
          onPress={() => soon('Выбор и оплата тарифа появятся позже.')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.planBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.planBtnText, { color: '#4E1764' }]}>Выбрать тариф</Text>
        </Pressable>
      </Grad>

      <Sect>Умные функции</Sect>
      {features.map((f) => (
        <Pressable
          key={f.title}
          onPress={() => soon(`«${f.title}» — подключение появится позже.`)}
          accessibilityRole="button"
          accessibilityLabel={`${f.title}: ${f.about}`}
          style={[styles.feat, { backgroundColor: c.pink2 }]}
        >
          <View style={[styles.ic, { backgroundColor: c.surface }]}><Text style={{ fontSize: 19 }}>{f.icon}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.featTitle, { color: c.ink }]}>{f.title}</Text>
            <Text style={[styles.featText, { color: c.inkSoft }]}>{f.about}</Text>
          </View>
          <Text style={[styles.plus, { color: c.magenta }]}>+</Text>
        </Pressable>
      ))}

      <Sect>Выбрать врача</Sect>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docpick}>
        {doctors.map((d) => (
          <Pressable
            key={d.name}
            onPress={() => soon('Выбор специалиста — в расширенном тарифе.')}
            accessibilityRole="button"
            style={[styles.doc, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[styles.av, { backgroundColor: c.pink }]}>
              <Text style={[styles.avText, { color: c.pinkInk }]}>{d.initials}</Text>
            </View>
            <Text style={[styles.docName, { color: c.ink }]}>{d.name}</Text>
            <Text style={[styles.docAbout, { color: c.inkMute }]}>{d.about}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Sect>Партнёры и предложения</Sect>
      {partners.map((p) => (
        <View key={p.title} style={[styles.ad, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.ph, { backgroundColor: c.pink2 }]}><Text style={{ fontSize: 23 }}>{p.icon}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.adTitle, { color: c.ink }]}>{p.title}</Text>
            <Text style={[styles.adText, { color: c.inkMute }]}>{p.about}</Text>
            <Text style={[styles.kind, { color: c.inkMute }]}>{p.kind.toUpperCase()}</Text>
          </View>
        </View>
      ))}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  plan: { borderRadius: radius.m, paddingHorizontal: 18, paddingVertical: 20, marginTop: 4 },
  eyebrow: { color: '#fff', opacity: 0.8, fontFamily: fonts.body700, fontSize: 11.5, letterSpacing: 1.5 },
  planTitle: { color: '#fff', fontFamily: fonts.head700, fontSize: 24, marginTop: 7, marginBottom: 6 },
  planText: { color: '#fff', opacity: 0.92, fontFamily: fonts.body500, fontSize: 14, lineHeight: 20, marginBottom: 15 },
  planBtn: { backgroundColor: '#fff', borderRadius: radius.pill, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { fontFamily: fonts.head700, fontSize: 16 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 13,
    minHeight: 66 },
  ic: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontFamily: fonts.body700, fontSize: 14.5 },
  featText: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  plus: { fontFamily: fonts.body700, fontSize: 22 },
  docpick: { gap: 10, paddingBottom: 3 },
  doc: { width: 136, borderWidth: 1.5, borderRadius: 17, padding: 13, alignItems: 'center' },
  av: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avText: { fontFamily: fonts.head700, fontSize: 16 },
  docName: { fontFamily: fonts.body700, fontSize: 13.5, textAlign: 'center', lineHeight: 17 },
  docAbout: { fontFamily: fonts.body500, fontSize: 11.5, textAlign: 'center', marginTop: 3 },
  ad: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: radius.m, padding: 14 },
  ph: { width: 58, height: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  adTitle: { fontFamily: fonts.body700, fontSize: 14.5 },
  adText: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  kind: { fontFamily: fonts.body700, fontSize: 10, letterSpacing: 1, marginTop: 5 },
});
