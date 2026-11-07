import Svg, { Path } from 'react-native-svg';

const paths = {
  back: ['M15 18l-6-6 6-6'],
  next: ['M9 6l6 6-6 6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  mail: ['M3 6h18v12H3z', 'm3 7 9 6 9-6'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  patient: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'],
  caregiver: ['M12 21s-7-4.4-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z'],
  doctor: ['M9 3v4a3 3 0 0 0 6 0V3', 'M12 10v4a5 5 0 0 0 10 0v-1', 'M22 11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  logout: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  close: ['M6 6l12 12M18 6 6 18'],
  home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  chat: ['M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.2A8.4 8.4 0 1 1 21 11.5z'],
  bag: ['M6 7h12l1 13H5zM9 7a3 3 0 0 1 6 0'],
  mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0M12 18v3'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01'],
  send: ['M5 12h14M13 6l6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M8.5 12l2.5 2.5 4.5-5'],
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round">
      {paths[name].map((d) => <Path key={d} d={d} />)}
    </Svg>
  );
}
