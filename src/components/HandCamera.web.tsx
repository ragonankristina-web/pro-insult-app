import { useEffect, useRef, useState } from 'react';

import type { HandCameraProps, Side } from './HandCamera';
import { PoseCamera } from './PoseCamera';
import { KP, SCORE, type PoseFrame } from '../lib/rtmpose';

// Браузер: поднятая рука по захвату движений RTMPose. Поднята = запястье выше линии плеч.
// Картинка зеркальная, поэтому сторону берём по экрану: рука, которая у пациента в зеркале слева, — «левая».

export const handCameraSupported = true;

const HOLD = 350; // мс — рука поднята уверенно, а не случайно
const REST = 300; // мс — обе руки опущены, можно выбирать снова

export function HandCamera({ onRaise }: HandCameraProps) {
  const handler = useRef(onRaise);
  useEffect(() => {
    handler.current = onRaise;
  });
  const [side, setSide] = useState<Side | null>(null);
  const st = useRef({ armed: true, candidate: null as Side | null, since: 0, restSince: 0 });

  const onPose = (f: PoseFrame | null) => {
    const s = st.current;
    const now = performance.now();
    if (!f) {
      s.candidate = null;
      return setSide(null);
    }
    const p = f.points;
    const shoulderY = (p[KP.leftShoulder].y + p[KP.rightShoulder].y) / 2;
    const midX = (p[KP.leftShoulder].x + p[KP.rightShoulder].x) / 2;
    // В исходном (незеркальном) кадре правее середины — то, что в зеркале слева.
    const up = [p[KP.leftWrist], p[KP.rightWrist]]
      .filter((w) => w.score > SCORE && w.y < shoulderY - 0.04 * f.height)
      .map((w): Side => (w.x > midX ? 'left' : 'right'));
    const raised = up.length === 1 ? up[0] : null;
    if (raised) {
      if (raised !== s.candidate) {
        s.candidate = raised;
        s.since = now;
      } else if (s.armed && now - s.since > HOLD) {
        s.armed = false;
        handler.current(raised);
      }
    } else {
      if (s.candidate || !s.restSince) s.restSince = now;
      s.candidate = null;
      if (!up.length && !s.armed && now - s.restSince > REST) s.armed = true;
    }
    setSide(raised);
  };

  return (
    <PoseCamera
      onPose={onPose}
      frameColor={side ? '#2FD27A' : '#B9B4BC'}
      label={side === 'left' ? 'Левая рука ↑' : side === 'right' ? 'Правая рука ↑' : 'Поднимите левую или правую руку.'}
    />
  );
}
