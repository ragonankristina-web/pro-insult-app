import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PoseCameraProps } from './PoseCamera';
import { BODY_LINES, HAND_LINES, KP, SCORE, type PoseFrame } from '../lib/rtmpose';
import { loadRtmPose } from '../lib/rtmposeWeb';
import { fonts, radius } from '../theme/tokens';

// Браузер: фронтальная камера и RTMPose (133 точки) на устройстве. Картинка зеркальная, как в зеркале;
// точки рисуются поверх видео тем же зеркалом.

export const poseCameraSupported = true;

type Status = 'starting' | 'model' | 'denied' | 'nomodel' | 'none' | 'ok';

const text: Record<Status, string> = {
  starting: 'Включаем камеру…',
  model: 'Загружаем захват движений (около 70 МБ, только в первый раз)…',
  denied: 'Нет доступа к камере — разрешите её в настройках браузера.',
  nomodel: 'Не удалось загрузить захват движений — проверьте интернет.',
  none: 'Сядьте так, чтобы были видны плечи и руки.',
  ok: 'Человек в кадре.',
};

function draw(canvas: HTMLCanvasElement | null, f: PoseFrame) {
  if (!canvas) return;
  if (canvas.width !== f.width || canvas.height !== f.height) {
    canvas.width = f.width;
    canvas.height = f.height;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, f.width, f.height);
  const p = f.points;
  const u = f.width / 320; // толщина линий от размера кадра
  ctx.lineCap = 'round';
  const lines = (pairs: [number, number][], base: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const [a, b] of pairs) {
      const A = p[base + a];
      const B = p[base + b];
      if (A.score < SCORE || B.score < SCORE) continue;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }
  };
  const dots = (from: number, to: number, color: string, r: number) => {
    ctx.fillStyle = color;
    for (let i = from; i < to; i++) {
      if (p[i].score < SCORE) continue;
      ctx.beginPath();
      ctx.arc(p[i].x, p[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  lines(BODY_LINES, 0, 'rgba(224,123,192,0.95)', 3 * u);
  lines(HAND_LINES, KP.leftHand, 'rgba(47,210,122,0.95)', 1.6 * u);
  lines(HAND_LINES, KP.rightHand, 'rgba(47,210,122,0.95)', 1.6 * u);
  dots(23, 91, 'rgba(131,205,255,0.8)', 1.1 * u); // лицо
  dots(0, 23, '#FFC93C', 3 * u); // тело и стопы
  dots(91, 133, '#ffffff', 1.5 * u); // пальцы
}

export function PoseCamera({ onPose, frameColor = '#B9B4BC', label, aspect = 4 / 3, skeleton = true }: PoseCameraProps) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const opts = useRef({ onPose, skeleton });
  useEffect(() => {
    opts.current = { onPose, skeleton };
  });
  const [status, setStatus] = useState<Status>('starting');
  const [info, setInfo] = useState('');

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
      let pose: Awaited<ReturnType<typeof loadRtmPose>>;
      try {
        pose = await loadRtmPose();
      } catch {
        if (!stopped) setStatus('nomodel');
        return;
      }
      if (stopped) return;
      pose.reset();

      let shown: Status = 'model';
      const show = (s: Status) => s !== shown && setStatus((shown = s));
      let infoAt = 0;
      const tick = async () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.videoWidth) {
          const f = await pose.detect(v);
          if (stopped) return;
          const found = f.points[KP.leftShoulder].score > SCORE && f.points[KP.rightShoulder].score > SCORE;
          show(found ? 'ok' : 'none');
          const c = canvas.current;
          if (opts.current.skeleton && found) draw(c, f);
          else c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
          opts.current.onPose(found ? f : null);
          const now = performance.now();
          if (now - infoAt > 1000) {
            infoAt = now;
            setInfo(`RTMPose · ${pose.backend === 'webgpu' ? 'видеокарта' : 'процессор'} · ${Math.round(f.ms)} мс/кадр`);
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

  const mirror = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' } as const;
  return (
    <View style={[styles.wrap, { aspectRatio: aspect }]}>
      <video ref={video} muted playsInline autoPlay style={mirror} />
      <canvas ref={canvas} style={{ ...mirror, pointerEvents: 'none' }} />
      <View pointerEvents="none" style={[styles.frame, { borderColor: frameColor }]} />
      {info ? (
        <View pointerEvents="none" style={styles.infoWrap}>
          <Text style={styles.info}>{info}</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.labelWrap}>
        <Text style={styles.label} accessibilityLiveRegion="polite">{status === 'ok' && label ? label : text[status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.s, overflow: 'hidden', backgroundColor: '#1B1420' },
  frame: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 2, borderRadius: 16 },
  infoWrap: { position: 'absolute', left: 16, top: 16 },
  info: { backgroundColor: 'rgba(20,13,25,0.6)', color: '#fff', fontFamily: fonts.body600, fontSize: 11, borderRadius: 99,
    paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  labelWrap: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  label: { backgroundColor: 'rgba(20,13,25,0.72)', color: '#fff', fontFamily: fonts.body600, fontSize: 13, borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center', overflow: 'hidden' },
});
