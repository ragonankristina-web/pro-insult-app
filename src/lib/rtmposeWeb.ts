import { boxAround, decode, INPUT_H, INPUT_W, SCORE, toTensor, wholeFrame, type Box, type PoseFrame } from './rtmpose';

// RTMPose в браузере через ONNX Runtime Web: на видеокарте (WebGPU), если есть, иначе на процессоре (WASM).
// Считается на устройстве — кадры никуда не отправляются; модель (~70 МБ) лежит в public/models
// и грузится один раз, дальше берётся из кэша браузера. Вызывается только из *.web.tsx.

const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const MODEL = '/models/rtmpose-m-wholebody.onnx';

// import() по адресу CDN прячем от сборщика — модуль грузится только в браузере.
const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

export class RtmPose {
  private box: Box | null = null;
  private canvas = document.createElement('canvas');
  private tensor = new Float32Array(3 * INPUT_W * INPUT_H);

  constructor(
    private ort: any,
    private session: any,
    readonly backend: 'webgpu' | 'wasm',
  ) {}

  // Новая камера — начинаем поиск человека с целого кадра.
  reset() {
    this.box = null;
  }

  async detect(video: HTMLVideoElement): Promise<PoseFrame> {
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, W, H);
    const rgba = ctx.getImageData(0, 0, W, H).data;
    const box = this.box ?? wholeFrame(W, H);
    const t0 = performance.now();
    const input = new this.ort.Tensor('float32', toTensor(rgba, W, H, box, this.tensor), [1, 3, INPUT_H, INPUT_W]);
    const out = await this.session.run({ input });
    const points = decode(out.simcc_x.data, out.simcc_y.data, 133, box);
    // Следующий кадр ищем рядом; человека нет — снова по всему кадру.
    this.box = boxAround(points, SCORE);
    return { points, width: W, height: H, ms: performance.now() - t0 };
  }
}

let loading: Promise<RtmPose> | null = null;

export function loadRtmPose() {
  loading ??= create().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

async function create() {
  const ort = await importUrl(`${ORT}ort.webgpu.min.mjs`);
  ort.env.wasm.wasmPaths = ORT;
  // Несколько потоков браузер даёт только изолированной странице; иначе — один.
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  const res = await fetch(MODEL);
  if (!res.ok) throw new Error(`model ${res.status}`);
  const model = new Uint8Array(await res.arrayBuffer());
  const warmup = async (session: any) => {
    const x = new ort.Tensor('float32', new Float32Array(3 * INPUT_W * INPUT_H), [1, 3, INPUT_H, INPUT_W]);
    await session.run({ input: x });
    return session;
  };
  if ((navigator as any).gpu) {
    try {
      const session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] });
      return new RtmPose(ort, await warmup(session), 'webgpu');
    } catch {
      // видеокарта не подошла — считаем на процессоре
    }
  }
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  return new RtmPose(ort, await warmup(session), 'wasm');
}
