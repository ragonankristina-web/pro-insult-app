import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HandCameraProps, Side } from './HandCamera';
import { loadPoseLandmarker, type PoseLandmarker } from '../lib/mediapipe';
import { fonts, radius } from '../theme/tokens';

// Браузер: фронтальная камера и поза MediaPipe (на устройстве). Поднятая рука = кисть выше плеч.
// Картинка зеркальная, поэтому сторону берём по экрану: рука, которая у пациента в зеркале слева, — «левая».

export const handCameraSupported = true;

type Status = 'starting' | 'model' | 'denied' | 'nomodel' | 'none' | 'person' | Side;

const text: Record<Status, string> = {
  starting: 'Включаем камеру…',
  model: 'Загружаем распознавание рук…',
  denied: 'Нет доступа к камере — разрешите её в настройках браузера.',
  nomodel: 'Не удалось загрузить распознавание — проверьте интернет.',
  none: 'Встаньте или сядьте так, чтобы были видны плечи.',
  person: 'Поднимите левую или правую руку.',
  left: 'Левая рука ↑',
  right: 'Правая рука ↑',
};

const HOLD = 350; // мс — рука поднята уверенно, а не случайно
const REST = 300; // мс — обе руки опущены, можно выбирать снова

export function HandCamera({ onRaise }: HandCameraProps) {
  const video = useRef<HTMLVideoElement>(null);
  const handler = useRef(onRaise);
  useEffect(() => {
    handler.current = onRaise;
  });
  const [status, setStatus] = useState<Status>('starting');

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let raf = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      } catch {
        if (!stopped) setStatus('denied');
        return;
      }
      const v = video.current;
      if (stopped || !v) return stream.getTracks().forEach((t) => t.stop());
      v.srcObject = stream;
      await v.play().catch(() => {});
      setStatus('model');
      let pose: PoseLandmarker;
      try {
        pose = await loadPoseLandmarker();
      } catch {
        if (!stopped) setStatus('nomodel');
        return;
      }
      if (stopped) return;

      let shown: Status = 'model';
      const show = (s: Status) => s !== shown && setStatus((shown = s));
      let armed = true;
      let candidate: Side | null = null;
      let since = 0;
      let restSince = 0;
      let last = -1;
      const tick = () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.currentTime !== last) {
          last = v.currentTime;
          const now = performance.now();
          const lm = pose.detectForVideo(v, now).landmarks[0];
          if (!lm) {
            show('none');
          } else {
            const shoulderY = (lm[11].y + lm[12].y) / 2;
            const midX = (lm[11].x + lm[12].x) / 2;
            // В исходном (незеркальном) кадре правее середины — то, что в зеркале слева.
            const up = [lm[15], lm[16]]
              .filter((p) => (p.visibility ?? 1) > 0.5 && p.y < shoulderY - 0.04)
              .map((p): Side => (p.x > midX ? 'left' : 'right'));
            const side = up.length === 1 ? up[0] : null;
            if (side) {
              if (side !== candidate) {
                candidate = side;
                since = now;
              } else if (armed && now - since > HOLD) {
                armed = false;
                handler.current(side);
              }
              show(side);
            } else {
              if (candidate || !restSince) restSince = now;
              candidate = null;
              if (!up.length && !armed && now - restSince > REST) armed = true;
              show('person');
            }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const raised = status === 'left' || status === 'right';
  return (
    <View style={styles.wrap}>
      <video ref={video} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <View pointerEvents="none" style={[styles.frame, { borderColor: raised ? '#2FD27A' : '#B9B4BC' }]} />
      <View pointerEvents="none" style={styles.labelWrap}>
        <Text style={styles.label} accessibilityLiveRegion="polite">{text[status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.s, overflow: 'hidden', backgroundColor: '#1B1420' },
  frame: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 2, borderRadius: 16 },
  labelWrap: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  label: { backgroundColor: 'rgba(20,13,25,0.72)', color: '#fff', fontFamily: fonts.body600, fontSize: 13, borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center', overflow: 'hidden' },
});
