import * as Speech from 'expo-speech';

// Голос Брэйни. В приложении на телефоне — синтез речи устройства; в браузере — голос «Руслан» (voice.web.ts).

export const voiceName = 'голос устройства';

// Подготовить голос заранее (по нажатию — тогда браузер разрешает звук).
export function warmUpVoice() {}

// Сказать вслух; onDone — когда закончил (или не смог).
export function say(text: string, onDone: () => void) {
  Speech.stop();
  Speech.speak(text, { language: 'ru-RU', rate: 0.85, onDone, onStopped: onDone, onError: onDone });
}

export function stopSaying() {
  Speech.stop();
}
