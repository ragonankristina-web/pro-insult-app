// Упражнения раздела «Речь»: видео-пример (assets/exercises/speech) и правило проверки по камере.
// Проверка — по коэффициентам мимики (blendshapes) модели MediaPipe Face Landmarker, 0…1.

export type Blend = Record<string, number>;

// idle — лица нет или пациент в покое (рамка серая), ok — движение верное (зелёная),
// warn — движение начато, но не до конца или неравномерно (жёлтая).
export type Verdict = { state: 'idle' | 'ok' | 'warn'; hint: string };

export type Exercise = {
  id: string;
  group: string;
  title: string;
  about: string;
  steps: string[];
  reps: number;
  video: number; // require() видео-примера
  judge?: (b: Blend) => Verdict; // нет — автопроверка для упражнения пока недоступна
};

const avg = (a: number, b: number) => (a + b) / 2;
// Разница сторон больше 40% от сильной — движение неравномерное (важно после инсульта).
const uneven = (l: number, r: number) => Math.abs(l - r) > 0.4 * Math.max(l, r);

export const speechExercises: Exercise[] = [
  {
    id: 'lips-tube',
    group: 'Губы',
    title: 'Губы трубочкой',
    about: '5 секунд · 10 повторов',
    steps: ['Сомкните губы и вытяните их вперёд трубочкой.', 'Задержите на 3 секунды.', 'Расслабьте губы.'],
    reps: 10,
    video: require('../../assets/exercises/speech/lips-tube.mp4'),
    judge: (b) => {
      const v = Math.max(b.mouthPucker ?? 0, b.mouthFunnel ?? 0);
      if (v > 0.55) return { state: 'ok', hint: 'Верно! Задержите трубочку.' };
      if (v > 0.2) return { state: 'warn', hint: 'Вытяните губы сильнее вперёд.' };
      return { state: 'idle', hint: 'Вытяните губы трубочкой.' };
    },
  },
  {
    id: 'lips-corners',
    group: 'Губы',
    title: 'Уголки губ вверх и вниз',
    about: '7 секунд · 10 повторов',
    steps: ['Улыбнитесь, поднимая оба уголка губ вверх.', 'Затем опустите уголки вниз.', 'Чередуйте медленно.'],
    reps: 10,
    video: require('../../assets/exercises/speech/lips-corners.mp4'),
    judge: (b) => {
      const sl = b.mouthSmileLeft ?? 0;
      const sr = b.mouthSmileRight ?? 0;
      const fl = b.mouthFrownLeft ?? 0;
      const fr = b.mouthFrownRight ?? 0;
      if (avg(sl, sr) > 0.45) {
        return uneven(sl, sr)
          ? { state: 'warn', hint: 'Одна сторона поднимается слабее — помогите ей.' }
          : { state: 'ok', hint: 'Верно! Уголки вверх. Теперь вниз.' };
      }
      if (avg(fl, fr) > 0.3) {
        return uneven(fl, fr)
          ? { state: 'warn', hint: 'Опускайте оба уголка одинаково.' }
          : { state: 'ok', hint: 'Верно! Уголки вниз. Теперь вверх.' };
      }
      if (avg(sl, sr) > 0.15 || avg(fl, fr) > 0.12) return { state: 'warn', hint: 'Сильнее — до конца вверх или вниз.' };
      return { state: 'idle', hint: 'Поднимите уголки губ вверх.' };
    },
  },
  {
    id: 'tongue-forward',
    group: 'Язык',
    title: 'Язык вперёд',
    about: '8 секунд · 8 повторов',
    steps: ['Откройте рот.', 'Вытяните язык вперёд как можно дальше, не касаясь губ.', 'Уберите язык и закройте рот.'],
    reps: 8,
    video: require('../../assets/exercises/speech/tongue-forward.mp4'),
    // Модель мимики не распознаёт язык — проверка появится с другой моделью.
  },
  {
    id: 'air-roll',
    group: 'Щёки',
    title: 'Перекат воздуха',
    about: '6 секунд · 8 повторов',
    steps: ['Наберите воздух в щёки, губы сомкнуты.', 'Перекатывайте воздух из одной щеки в другую.', 'Выдохните.'],
    reps: 8,
    video: require('../../assets/exercises/speech/air-roll.mp4'),
    judge: (b) => {
      const v = b.cheekPuff ?? 0;
      if (v > 0.4) return { state: 'ok', hint: 'Верно! Щёки надуты — перекатывайте воздух.' };
      if (v > 0.12) return { state: 'warn', hint: 'Наберите больше воздуха, губы плотно сомкнуты.' };
      return { state: 'idle', hint: 'Надуйте щёки.' };
    },
  },
];

export const speechGroups = [...new Set(speechExercises.map((e) => e.group))];

// Камера пациента (PatientCamera / PatientCamera.web): сообщает оценку каждого кадра.
export type CameraProps = { judge?: Exercise['judge']; onVerdict: (v: Verdict) => void };
