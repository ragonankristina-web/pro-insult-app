// Голосовые команды. В приложении на телефоне распознавания речи пока нет — понадобится отдельная сборка
// с модулем распознавания; в браузере работает useVoice.web.ts.

export type VoiceState = { supported: boolean; denied: boolean; heard: string };

export function setVoiceMuted(_on: boolean) {}

export function useVoice(_enabled: boolean, _onText: (text: string, final: boolean) => boolean): VoiceState {
  return { supported: false, denied: false, heard: '' };
}
