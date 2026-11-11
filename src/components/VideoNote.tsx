import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Message } from '../lib/demo';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

// Видеокружок в переписке, как в Telegram: крутится без звука; нажали — с начала со звуком, ещё раз — снова тихо.
// Видео лежит в закрытом хранилище — берём временную ссылку на час (видят только отправитель и получатель).

type Video = NonNullable<Message['video']>;

const links = new Map<string, { url: string; until: number }>();
const fresh = (path?: string) => {
  const hit = path ? links.get(path) : undefined;
  return hit && hit.until > Date.now() ? hit.url : undefined;
};

function useVideoUrl(v: Video) {
  const [url, setUrl] = useState<string | undefined>(() => v.url ?? fresh(v.path));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (v.url || !v.path || fresh(v.path)) return;
    let alive = true;
    const path = v.path;
    supabase.storage
      .from('video-notes')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) return setFailed(true);
        links.set(path, { url: data.signedUrl, until: Date.now() + 55 * 60_000 });
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [v.url, v.path]);
  return { url: v.url ?? fresh(v.path) ?? url, failed };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

export function VideoNote({ video, mine, meta }: { video: Video; mine: boolean; meta: string }) {
  const { c } = useTheme();
  const { url, failed } = useVideoUrl(video);
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { borderColor: mine ? c.magenta : c.surface, backgroundColor: '#1B1420' }]}>
        {url ? (
          <Player url={url} seconds={video.seconds} />
        ) : failed ? (
          <Text style={styles.fail}>Видео недоступно</Text>
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>
      {meta ? (
        <Text style={[styles.meta, { backgroundColor: c.surface, color: c.inkSoft }, mine ? styles.right : styles.left]}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function Player({ url, seconds }: { url: string; seconds: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // Плеером управляем через ссылку: звук включается по нажатию, а не при отрисовке.
  const ref = useRef(player);
  useEffect(() => {
    ref.current = player;
  });
  const [sound, setSound] = useState(false);
  const toggle = () => {
    const p = ref.current;
    if (sound) {
      p.muted = true;
    } else {
      p.currentTime = 0;
      p.muted = false;
      p.play();
    }
    setSound(!sound);
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={sound ? 'Выключить звук видеокружка' : `Видеокружок ${mmss(seconds)}, включить со звуком`}
      style={StyleSheet.absoluteFill}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <View pointerEvents="none" style={styles.badge}>
        <Text style={styles.badgeText}>{`${sound ? '🔊' : '🔇'} ${mmss(seconds)}`}</Text>
      </View>
    </Pressable>
  );
}

const SIZE = 200;

const styles = StyleSheet.create({
  wrap: { width: SIZE, alignItems: 'center' },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, overflow: 'hidden', alignItems: 'center',
    justifyContent: 'center' },
  fail: { color: '#fff', fontFamily: fonts.body600, fontSize: 13 },
  badge: { position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: 'rgba(20,13,25,0.6)', borderRadius: 99,
    paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: '#fff', fontFamily: fonts.body700, fontSize: 11.5 },
  meta: { fontFamily: fonts.body600, fontSize: 11, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
    overflow: 'hidden' },
  right: { alignSelf: 'flex-end' },
  left: { alignSelf: 'flex-start' },
});
