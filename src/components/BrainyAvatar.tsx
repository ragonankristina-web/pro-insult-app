import { Image } from 'expo-image';

import { useMood, type Mood } from '../lib/brainyMood';

// Брэйни — утверждённые анимации из папки «Брэйни» (кадры 1080×1080 → анимированный WebP с прозрачностью,
// 260×290, 15 кадров/с): спокойная поза, разговор, счастье, грусть, злость; ожидание — переминается, засыпает,
// спит, просыпается.

const sources: Record<Mood, number> = {
  idle: require('../../assets/brainy/idle.png'),
  talk: require('../../assets/brainy/talk.webp'),
  happy: require('../../assets/brainy/happy.webp'),
  sad: require('../../assets/brainy/sad.webp'),
  angry: require('../../assets/brainy/angry.webp'),
  tired: require('../../assets/brainy/tired.webp'),
  fallAsleep: require('../../assets/brainy/fall-asleep.webp'),
  sleep: require('../../assets/brainy/sleep.webp'),
  wakeUp: require('../../assets/brainy/wake-up.webp'),
};

export const BRAINY_RATIO = 290 / 260; // высота к ширине

const label: Record<Mood, string> = {
  idle: 'Брэйни',
  talk: 'Брэйни говорит',
  happy: 'Брэйни радуется',
  sad: 'Брэйни грустит',
  angry: 'Брэйни сердится',
  tired: 'Брэйни переминается с ноги на ногу',
  fallAsleep: 'Брэйни засыпает',
  sleep: 'Брэйни спит',
  wakeUp: 'Брэйни просыпается',
};

export function BrainyAvatar({ width = 80, mood }: { width?: number; mood?: Mood }) {
  const live = useMood();
  const m = mood ?? live.mood;
  return (
    <Image
      // новая эмоция (или та же заново) — ролик с начала
      key={`${m}-${mood ? 0 : live.stamp}`}
      source={sources[m]}
      style={{ width, height: width * BRAINY_RATIO }}
      contentFit="contain"
      autoplay
      cachePolicy="memory-disk"
      accessibilityLabel={label[m]}
    />
  );
}
