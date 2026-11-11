import { importUrl, loadOrt } from './ortWeb';

// Голос Брэйни в браузере — Piper (rhasspy), русский голос «Руслан». Считается на устройстве:
// текст → звуки речи (espeak-ng, модуль piper_phonemize) → модель голоса (ONNX Runtime, WASM) → звук.
// Модель (~63 МБ) лежит в public/models; модуль и словари espeak (~18 МБ) — с CDN. Всё грузится один раз,
// дальше берётся из кэша браузера. Лицензия голоса — некоммерческая, см. public/models/README.md.

const MODEL = '/models/ru_RU-ruslan-medium.onnx';
const PHONEMIZE = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist/piper-o91UDS6e.js';
const ESPEAK = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';

type Config = {
  espeak: { voice: string };
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
};

type Voice = {
  ort: any;
  session: any;
  config: Config;
  createPhonemize: (m: object) => Promise<{ callMain: (args: string[]) => void }>;
  espeakData: ArrayBuffer;
  espeakWasm: ArrayBuffer;
};

const bytes = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.arrayBuffer();
};

let loading: Promise<Voice> | null = null;
let ready = false;

export const voiceReady = () => ready;

export function loadVoice() {
  loading ??= (async () => {
    const [ort, mod, config, model, espeakData, espeakWasm] = await Promise.all([
      loadOrt(),
      importUrl(PHONEMIZE),
      bytes(`${MODEL}.json`).then((b) => JSON.parse(new TextDecoder().decode(b)) as Config),
      bytes(MODEL),
      bytes(`${ESPEAK}.data`),
      bytes(`${ESPEAK}.wasm`),
    ]);
    const session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'] });
    ready = true;
    return { ort, session, config, createPhonemize: mod.createPiperPhonemize, espeakData, espeakWasm };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

// Текст → номера звуков речи. На каждое предложение модуль печатает свой список.
async function phonemize(v: Voice, text: string) {
  const lists: number[][] = [];
  const m = await v.createPhonemize({
    print: (line: string) => lists.push(JSON.parse(line).phoneme_ids),
    printErr: () => {},
    wasmBinary: v.espeakWasm,
    getPreloadedPackage: () => v.espeakData.slice(0),
    locateFile: (u: string) => u,
  });
  m.callMain(['-l', v.config.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  return lists;
}

// Речь целиком: предложения подряд с короткой паузой. rate < 1 — медленнее (пациентам так легче).
export async function synthesize(text: string, rate = 0.85) {
  const v = await loadVoice();
  const { noise_scale, length_scale, noise_w } = v.config.inference;
  const sampleRate = v.config.audio.sample_rate;
  const pause = new Float32Array(Math.round(sampleRate * 0.18));
  const parts: Float32Array[] = [];
  for (const ids of await phonemize(v, text)) {
    if (!ids?.length) continue;
    const out = await v.session.run({
      input: new v.ort.Tensor('int64', BigInt64Array.from(ids, (n) => BigInt(n)), [1, ids.length]),
      input_lengths: new v.ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new v.ort.Tensor('float32', Float32Array.from([noise_scale, length_scale / rate, noise_w]), [3]),
    });
    if (parts.length) parts.push(pause);
    parts.push(out.output.data as Float32Array);
  }
  const pcm = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    pcm.set(p, o);
    o += p.length;
  }
  return { pcm, sampleRate };
}
