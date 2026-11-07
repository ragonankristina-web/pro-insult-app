// Выбор поднятой рукой. В приложении на телефоне распознавания позы пока нет — понадобится отдельная сборка;
// в браузере работает HandCamera.web.tsx.

export type Side = 'left' | 'right';
export type HandCameraProps = { onRaise: (side: Side) => void };

export const handCameraSupported = false;

export function HandCamera(_: HandCameraProps) {
  return null;
}
