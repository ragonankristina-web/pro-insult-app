// RTMPose (OpenMMLab, Apache-2.0): точки всего тела по кадру камеры. Здесь — математика без браузера:
// вырезать человека из кадра в вход модели 192×256 и перевести её ответ (SimCC) обратно в точки на кадре.
// Модель — RTMPose-m whole-body, 133 точки в разметке COCO-WholeBody.

export const INPUT_W = 192;
export const INPUT_H = 256;
const SPLIT = 2; // simcc_split_ratio: на каждый пиксель входа — 2 ячейки ответа
const MEAN = [123.675, 116.28, 103.53];
const STD = [58.395, 57.12, 57.375];

export type Box = { cx: number; cy: number; w: number; h: number };
export type Keypoint = { x: number; y: number; score: number };
export type PoseFrame = { points: Keypoint[]; width: number; height: number; ms: number }; // точки в пикселях кадра
export const SCORE = 0.3; // точка найдена уверенно

// Номера точек COCO-WholeBody. «Левая» — левая сторона самого человека.
export const KP = {
  nose: 0,
  leftShoulder: 5, rightShoulder: 6,
  leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10,
  leftHip: 11, rightHip: 12,
  leftHand: 91, rightHand: 112, // 21 точка кисти: 0 — запястье, 4 — кончик большого, 8 — указательного … 20 — мизинца
} as const;

// Линии скелета для рисования: тело и пальцы (у каждой кисти 5 пальцев по 4 сустава от запястья).
export const BODY_LINES: [number, number][] = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];
export const HAND_LINES: [number, number][] = [0, 1, 2, 3, 4].flatMap((f) => {
  const a = 1 + f * 4;
  return [[0, a], [a, a + 1], [a + 1, a + 2], [a + 2, a + 3]] as [number, number][];
});

// Рамка в пропорциях входа модели (3:4).
export function fitAspect(b: Box): Box {
  const k = INPUT_W / INPUT_H;
  return b.w > b.h * k ? { ...b, h: b.w / k } : { ...b, w: b.h * k };
}

// Первый кадр или человек потерян — смотрим на весь кадр.
export const wholeFrame = (W: number, H: number): Box => fitAspect({ cx: W / 2, cy: H / 2, w: W, h: H });

// Следующий кадр — рамка вокруг уверенно найденных точек с запасом на движение.
export function boxAround(kps: Keypoint[], thr: number, padding = 1.5): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (let i = 0; i < 23; i++) { // тело и стопы — по ним рамка стабильнее, чем по лицу и пальцам
    const p = kps[i];
    if (p.score < thr) continue;
    n++;
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  if (n < 4) return null;
  return fitAspect({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: (x1 - x0) * padding, h: (y1 - y0) * padding });
}

// Кадр RGBA (W×H) → тензор 1×3×256×192 для модели: рамка растягивается на вход (билинейно),
// за краем кадра — чёрное, цвета нормализуются как при обучении.
export function toTensor(rgba: Uint8ClampedArray | Uint8Array, W: number, H: number, box: Box, out?: Float32Array) {
  const t = out ?? new Float32Array(3 * INPUT_W * INPUT_H);
  const plane = INPUT_W * INPUT_H;
  const sx = box.w / INPUT_W;
  const sy = box.h / INPUT_H;
  const left = box.cx - box.w / 2;
  const top = box.cy - box.h / 2;
  for (let y = 0; y < INPUT_H; y++) {
    const fy = top + (y + 0.5) * sy - 0.5;
    const y0 = Math.floor(fy);
    const wy = fy - y0;
    for (let x = 0; x < INPUT_W; x++) {
      const fx = left + (x + 0.5) * sx - 0.5;
      const x0 = Math.floor(fx);
      const wx = fx - x0;
      const o = y * INPUT_W + x;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        // четыре соседних пикселя; за краем кадра — 0
        if (y0 >= 0 && y0 < H) {
          if (x0 >= 0 && x0 < W) v += (1 - wx) * (1 - wy) * rgba[(y0 * W + x0) * 4 + c];
          if (x0 + 1 >= 0 && x0 + 1 < W) v += wx * (1 - wy) * rgba[(y0 * W + x0 + 1) * 4 + c];
        }
        if (y0 + 1 >= 0 && y0 + 1 < H) {
          if (x0 >= 0 && x0 < W) v += (1 - wx) * wy * rgba[((y0 + 1) * W + x0) * 4 + c];
          if (x0 + 1 >= 0 && x0 + 1 < W) v += wx * wy * rgba[((y0 + 1) * W + x0 + 1) * 4 + c];
        }
        t[c * plane + o] = (v - MEAN[c]) / STD[c];
      }
    }
  }
  return t;
}

// Ответ модели: для каждой точки — распределение по X (384 ячейки) и по Y (512).
// Берём максимум по каждой оси; уверенность — меньший из двух максимумов (как в mmpose).
export function decode(simccX: Float32Array, simccY: Float32Array, count: number, box: Box): Keypoint[] {
  const nx = simccX.length / count;
  const ny = simccY.length / count;
  const left = box.cx - box.w / 2;
  const top = box.cy - box.h / 2;
  const out: Keypoint[] = [];
  for (let k = 0; k < count; k++) {
    let bx = 0, mx = -Infinity;
    for (let i = 0, o = k * nx; i < nx; i++) if (simccX[o + i] > mx) { mx = simccX[o + i]; bx = i; }
    let by = 0, my = -Infinity;
    for (let i = 0, o = k * ny; i < ny; i++) if (simccY[o + i] > my) { my = simccY[o + i]; by = i; }
    out.push({
      x: left + (bx / SPLIT / INPUT_W) * box.w,
      y: top + (by / SPLIT / INPUT_H) * box.h,
      score: Math.min(mx, my),
    });
  }
  return out;
}

// Угол в суставе b (градусы) между отрезками b→a и b→c: локоть — плечо·локоть·запястье.
export function angle(a: Keypoint, b: Keypoint, c: Keypoint) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const cos = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
