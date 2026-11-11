// ONNX Runtime Web — общий для захвата движений (RTMPose) и голоса Брэйни (Piper).
// Грузится один раз с CDN; на видеокарте (WebGPU), если есть, иначе на процессоре (WASM). Только для *.web.

const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';

// import() по адресу CDN прячем от сборщика — модуль грузится только в браузере.
export const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

let loading: Promise<any> | null = null;

export function loadOrt() {
  loading ??= importUrl(`${ORT}ort.webgpu.min.mjs`)
    .then((ort) => {
      ort.env.wasm.wasmPaths = ORT;
      // Несколько потоков браузер даёт только изолированной странице; иначе — один.
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      return ort;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}
