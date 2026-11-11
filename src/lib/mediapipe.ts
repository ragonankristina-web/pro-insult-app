// Модель MediaPipe для браузера: мимика (упражнения «Речь»). Поза тела — RTMPose (rtmposeWeb.ts).
// Считаются прямо на устройстве — видео никуда не отправляется, из сети один раз загружается модель.
// Вызывается только из *.web.tsx.

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const MODELS = 'https://storage.googleapis.com/mediapipe-models';

export type FaceLandmarker = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
};

// import() по адресу CDN прячем от сборщика — модуль грузится только в браузере.
const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

function once<T>(make: () => Promise<T>) {
  let p: Promise<T> | null = null;
  return () => {
    p ??= make().catch((e) => {
      p = null;
      throw e;
    });
    return p;
  };
}

async function create<T>(kind: 'FaceLandmarker', model: string, options: object): Promise<T> {
  const vision = await importUrl(`${CDN}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const make = (delegate: 'GPU' | 'CPU') =>
    vision[kind].createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', ...options });
  // Видеокарта быстрее, но доступна не во всех браузерах — тогда считаем на процессоре.
  return make('GPU').catch(() => make('CPU'));
}

export const loadFaceLandmarker = once(() =>
  create<FaceLandmarker>('FaceLandmarker', `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, {
    outputFaceBlendshapes: true,
    numFaces: 1,
  }),
);

