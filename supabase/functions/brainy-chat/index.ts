// Брэйни — разговор с ИИ (GigaChat, Сбер). Функция Supabase: ключ GigaChat хранится только здесь
// (секрет GIGACHAT_AUTH_KEY), приложение присылает реплики пациента и получает короткий ответ Брэйни.
// Отвечает только вошедшим пользователям; не чаще 40 запросов в час на человека.
//
// Секреты (Supabase → Edge Functions → Secrets):
//   GIGACHAT_AUTH_KEY — «Ключ авторизации» проекта GigaChat API (developers.sber.ru), обязательно
//   GIGACHAT_MODEL    — модель, по умолчанию GigaChat-2 (можно GigaChat-2-Pro / GigaChat-2-Max)
//   GIGACHAT_SCOPE    — по умолчанию GIGACHAT_API_PERS (физлица)

import { createClient } from 'npm:@supabase/supabase-js@2';

// Серверы GigaChat подписаны корневым сертификатом Минцифры — его нет в стандартном наборе, передаём сами.
// https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt (действует до 27.02.2032)
const RUSSIAN_TRUSTED_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;

const OAUTH = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT = 'https://api.giga.chat/v1/chat/completions';
const AUTH_KEY = Deno.env.get('GIGACHAT_AUTH_KEY') ?? '';
const MODEL = Deno.env.get('GIGACHAT_MODEL') ?? 'GigaChat-2';
const SCOPE = Deno.env.get('GIGACHAT_SCOPE') ?? 'GIGACHAT_API_PERS';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// HTTP-клиент, который доверяет сертификату Минцифры.
// deno-lint-ignore no-explicit-any
let client: any;
try {
  // deno-lint-ignore no-explicit-any
  client = (Deno as any).createHttpClient({ caCerts: [RUSSIAN_TRUSTED_ROOT_CA] });
} catch {
  client = undefined;
}
const gigaFetch = (url: string, init: RequestInit) => fetch(url, client ? { ...init, client } as RequestInit : init);

// Токен доступа GigaChat живёт 30 минут — держим его и обновляем заранее.
let token = { value: '', until: 0 };
async function accessToken() {
  if (token.value && token.until - Date.now() > 60_000) return token.value;
  const res = await gigaFetch(OAUTH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      RqUID: crypto.randomUUID(),
      Authorization: `Basic ${AUTH_KEY}`,
    },
    body: `scope=${SCOPE}`,
  });
  if (!res.ok) throw new Error(`oauth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  token = { value: data.access_token, until: Number(data.expires_at) || Date.now() + 25 * 60_000 };
  return token.value;
}

// Не чаще 40 запросов в час на человека (в памяти экземпляра функции — для пилота достаточно).
const calls = new Map<string, number[]>();
function allowed(user: string) {
  const hour = Date.now() - 3_600_000;
  const list = (calls.get(user) ?? []).filter((t) => t > hour);
  if (list.length >= 40) return false;
  list.push(Date.now());
  calls.set(user, list);
  return true;
}

type Turn = { role: 'user' | 'assistant'; content: string };
type Context = { name?: string; role?: string; week?: string; left?: string[] };

function systemPrompt(ctx: Context) {
  const who =
    ctx.role === 'doctor' ? 'врачом-реабилитологом' : ctx.role === 'caregiver' ? 'человеком, который ухаживает за пациентом' : 'пациентом';
  const facts = [
    ctx.name ? `Собеседника зовут ${ctx.name}.` : '',
    ctx.week ? `Срок реабилитации: ${ctx.week}.` : '',
    ctx.left?.length ? `Сегодня в плане ещё не сделано: ${ctx.left.join('; ')}.` : '',
  ].filter(Boolean).join(' ');
  return `Ты — Брэйни, добрый помощник и собеседник в приложении «PRO Инсульт» для домашней реабилитации после инсульта (студенческий проект КубГМУ). Ты выглядишь как весёлый розовый мозг в очках и галстуке. Сейчас ты разговариваешь с ${who}.
Правила:
1. Отвечай по-русски, коротко: одно-три простых предложения, без сложных слов, списков, эмодзи и разметки — твой ответ читают вслух медленным голосом.
2. Будь тёплым, терпеливым и внимательным: поддерживай разговор, спрашивай о самочувствии, настроении, близких и увлечениях, хвали за старания, мягко напоминай о занятиях. Задавай не больше одного вопроса за раз.
3. После инсульта речь бывает обрывочной. Если фраза непонятна, угадай смысл и переспроси простым вопросом, на который можно ответить «да» или «нет».
4. Ты не врач. Не ставь диагнозы, не советуй и не меняй лекарства, дозы и лечение, не придумывай упражнения — по таким вопросам предлагай написать лечащему врачу в чате приложения.
5. Если описывают внезапное онемение или слабость руки или ноги, перекос лица, нарушение речи или зрения, сильную внезапную головную боль, потерю сознания — первым делом скажи немедленно звонить 103 или 112.
6. Если человек говорит, что хочет причинить себе вред или не хочет жить, — посочувствуй и попроси прямо сейчас позвонить 112 или близкому человеку.
7. Не выдумывай факты о человеке и его программе — используй только сведения ниже.
${facts}`.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Только POST' }, 405);
  if (!AUTH_KEY) return json({ error: 'not_configured' }, 503);

  // Только вошедшие пользователи приложения.
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'Войдите в аккаунт' }, 401);
  if (!allowed(user.id)) return json({ error: 'rate_limited' }, 429);

  let body: { messages?: Turn[]; context?: Context };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Неверный запрос' }, 400);
  }
  const turns = (body.messages ?? [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-12)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') return json({ error: 'Нет вопроса' }, 400);
  const ctx = body.context ?? {};

  try {
    const res = await gigaFetch(CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await accessToken()}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt(ctx) }, ...turns],
        temperature: 0.7,
        max_tokens: 220,
        repetition_penalty: 1,
        stream: false,
      }),
    });
    if (res.status === 429) return json({ error: 'busy' }, 429); // у физлиц GigaChat отвечает на один запрос за раз
    if (!res.ok) throw new Error(`chat ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const choice = data.choices?.[0];
    const reply = choice?.finish_reason === 'blacklist'
      ? 'Давай поговорим о чём-нибудь другом. Как ты себя сегодня чувствуешь?'
      : String(choice?.message?.content ?? '').trim();
    return json({ reply, model: data.model, usage: data.usage?.total_tokens });
  } catch (e) {
    console.error(e);
    return json({ error: client ? 'upstream' : 'no_ca_client', detail: String(e).slice(0, 300) }, 502);
  }
});
