import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Blend, CameraProps } from '../lib/exercises';
import { fonts } from '../theme/tokens';

// Браузер: фронтальная камера и распознавание мимики MediaPipe Face Landmarker прямо на устройстве —
// видео пациента никуда не отправляется, из сети загружается только сама модель (один раз).
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
};

// import() по адресу CDN прячем от сборщика — модуль грузится только в браузере и только здесь.
const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
let shared: Promise<Landmarker> | null = null;

function loadLandmarker() {
  shared ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await importUrl(`${CDN}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    // Видеокарта быстрее, но доступна не во всех браузерах — тогда считаем на процессоре.
    return make('GPU').catch(() => make('CPU'));
  })().catch((e) => {
    shared = null;
    throw e;
  });
  return shared;
}

type Status = 'starting' | 'model' | 'ready' | 'denied' | 'nomodel';

const messages: Partial<Record<Status, string>> = {
  starting: 'Включаем камеру…',
  model: 'Загружаем проверку движений…',
  denied: 'Нет доступа к камере. Разрешите камеру в настройках браузера (значок слева от адреса) и обновите страницу.',
  nomodel: 'Не удалось загрузить проверку движений — проверьте интернет. Камера работает, выполняйте по примеру.',
};

export function PatientCamera({ judge, onVerdict }: CameraProps) {
  const video = useRef<HTMLVideoElement>(null);
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
      if (!judge) return setStatus('ready');

      setStatus('model');
      let landmarker: Landmarker;
      try {
        landmarker = await loadLandmarker();
      } catch {
        if (!stopped) setStatus('nomodel');
        return;
      }
      if (stopped) return;
      setStatus('ready');

      // Сглаживаем коэффициенты, чтобы рамка не мигала от кадра к кадру.
      const smooth: Blend = {};
      let last = -1;
      const tick = () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.currentTime !== last) {
          last = v.currentTime;
          const face = landmarker.detectForVideo(v, performance.now()).faceBlendshapes?.[0];
          if (!face) {
            onVerdict({ state: 'idle', hint: 'Лицо не видно — сядьте прямо перед камерой.' });
          } else {
            for (const c of face.categories) smooth[c.categoryName] = 0.6 * (smooth[c.categoryName] ?? c.score) + 0.4 * c.score;
            onVerdict(judge(smooth));
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
  }, [judge, onVerdict]); // onVerdict у экрана упражнения стабилен (useCallback)

  const msg = messages[status];
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* зеркально, как в обычном зеркале */}
      <video ref={video} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      {msg ? (
        <View style={styles.msg}>
          <Text style={styles.msgText}>{msg}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  msg: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 28 },
  msgText: { color: '#fff', fontFamily: fonts.body600, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
