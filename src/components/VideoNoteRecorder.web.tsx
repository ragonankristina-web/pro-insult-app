import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Notice } from './ui';
import type { VideoNoteRecorderProps } from './VideoNoteRecorder';
import { fonts } from '../theme/tokens';

// Браузер: запись видеокружка с фронтальной камеры и микрофона (MediaRecorder), до минуты.
// Записали → можно пересмотреть, переснять или отправить. Пока не нажали «Отправить», видео никуда не уходит.

const MAX = 60; // секунд
const SIZE = 260;
const R = SIZE / 2 + 8;
const LEN = 2 * Math.PI * R;

type Phase = 'starting' | 'ready' | 'recording' | 'review' | 'sending' | 'denied';
type Clip = { blob: Blob; url: string; mime: string; seconds: number };

// Формат, который умеет записывать этот браузер (Chrome/Edge — webm, Safari — mp4).
function pickMime() {
  const MR = (globalThis as any).MediaRecorder;
  if (!MR) return null;
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MR.isTypeSupported?.(m)) ?? '';
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

export function VideoNoteRecorder({ onClose, onSend }: VideoNoteRecorderProps) {
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [phase, setPhase] = useState<Phase>('starting');
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    if (pickMime() === null || !navigator.mediaDevices) {
      setTimeout(() => !stopped && setPhase('denied'));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: true })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (live.current) {
          live.current.srcObject = s;
          live.current.play().catch(() => {});
        }
        setPhase('ready');
      })
      .catch(() => !stopped && setPhase('denied'));
    return () => {
      stopped = true;
      clearInterval(timer.current);
      if (rec.current?.state === 'recording') rec.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Освобождаем запись в памяти, когда она больше не нужна.
  useEffect(() => () => {
    if (clip) URL.revokeObjectURL(clip.url);
  }, [clip]);

  const stop = () => {
    clearInterval(timer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  };

  const start = () => {
    if (!stream.current) return;
    const mime = pickMime() || undefined;
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime, videoBitsPerSecond: 1_000_000 } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    r.onstop = () => {
      const type = (r.mimeType || mime || 'video/webm').split(';')[0];
      const blob = new Blob(chunks.current, { type });
      const seconds = Math.min(MAX, Math.max(1, Math.round((Date.now() - started.current) / 1000)));
      setClip({ blob, url: URL.createObjectURL(blob), mime: type, seconds });
      setPhase('review');
    };
    rec.current = r;
    r.start(250);
    started.current = Date.now();
    setElapsed(0);
    setError(null);
    setPhase('recording');
    timer.current = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(s);
      if (s >= MAX) stop();
    }, 200);
  };

  const retake = () => {
    setClip(null);
    setElapsed(0);
    setPhase('ready');
  };

  const send = async () => {
    if (!clip) return;
    setPhase('sending');
    const err = await onSend(clip.blob, clip.mime, clip.seconds);
    if (err) {
      setError(err);
      setPhase('review');
    } else onClose();
  };

  const progress = phase === 'recording' ? Math.min(1, elapsed / MAX) : 0;
  const reviewing = phase === 'review' || phase === 'sending';

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.back}>
        <Text style={styles.title}>Видеокружок</Text>
        <View style={styles.stage}>
          <Svg width={2 * R + 8} height={2 * R + 8} style={styles.ring}>
            <Circle cx={R + 4} cy={R + 4} r={R} stroke="rgba(255,255,255,0.18)" strokeWidth={5} fill="none" />
            <Circle
              cx={R + 4}
              cy={R + 4}
              r={R}
              stroke="#E07BC0"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${LEN}`}
              strokeDashoffset={LEN * (1 - progress)}
              transform={`rotate(-90 ${R + 4} ${R + 4})`}
            />
          </Svg>
          <View style={styles.circle}>
            {/* Живая камера — зеркально, как в зеркале; записанное видео — как его увидит собеседник. */}
            <video ref={live} muted playsInline autoPlay
              style={{ ...videoStyle, transform: 'scaleX(-1)', display: reviewing ? 'none' : 'block' }} />
            {reviewing && clip ? <video src={clip.url} autoPlay loop playsInline style={videoStyle} /> : null}
            {phase === 'starting' ? <ActivityIndicator color="#fff" style={styles.center} /> : null}
          </View>
        </View>

        <Text style={styles.time} accessibilityLiveRegion="polite">
          {phase === 'recording'
            ? `● ${mmss(elapsed)} / ${mmss(MAX)}`
            : reviewing && clip
              ? `${mmss(clip.seconds)} — посмотрите и отправьте`
              : phase === 'denied'
                ? ''
                : 'Смотрите в камеру и нажмите «Записать»'}
        </Text>

        {phase === 'denied' ? (
          <View style={styles.box}>
            <Notice tone="error">
              Нет доступа к камере или микрофону — разрешите их в настройках браузера. Запись работает в Chrome, Edge и Safari.
            </Notice>
            <Button title="Закрыть" variant="soft" onPress={onClose} />
          </View>
        ) : reviewing ? (
          <View style={styles.box}>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button title="Отправить" onPress={send} loading={phase === 'sending'} />
            <View style={styles.row}>
              <Button title="Переснять" variant="soft" onPress={retake} disabled={phase === 'sending'} style={{ flex: 1 }} />
              <Button title="Отмена" variant="soft" onPress={onClose} disabled={phase === 'sending'} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Отмена" style={styles.side}>
              <Text style={styles.sideText}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={phase === 'recording' ? stop : start}
              disabled={phase === 'starting'}
              accessibilityRole="button"
              accessibilityLabel={phase === 'recording' ? 'Остановить запись' : 'Записать'}
              style={[styles.recBtn, phase === 'starting' && { opacity: 0.5 }]}
            >
              <View style={phase === 'recording' ? styles.stopIcon : styles.recIcon} />
            </Pressable>
            <View style={styles.side}>
              <Text style={styles.sideText}>{phase === 'recording' ? 'Стоп' : 'Записать'}</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const videoStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } as const;

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(20,13,25,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 18 },
  title: { color: '#fff', fontFamily: fonts.head700, fontSize: 19 },
  stage: { width: 2 * R + 8, height: 2 * R + 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: '#000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  time: { color: '#fff', fontFamily: fonts.body700, fontSize: 15, minHeight: 20, textAlign: 'center' },
  box: { width: '100%', maxWidth: 360, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  side: { width: 80, alignItems: 'center' },
  sideText: { color: '#fff', fontFamily: fonts.body700, fontSize: 14 },
  recBtn: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center',
    justifyContent: 'center' },
  recIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E5484D' },
  stopIcon: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#E5484D' },
});
