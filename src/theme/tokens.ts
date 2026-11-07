// Цвета и размеры из макета «PRO_Инсульт_новый_дизайн» (светлая и тёмная версии).

export const palette = {
  light: {
    bg: '#FBF6FB',
    surface: '#FFFFFF',
    pink: '#EABDDE', // карточки и панели
    pink2: '#F6E2F2', // подложки, поля ввода
    pinkInk: '#6B2A5C',
    plum: '#4E1764',
    magenta: '#CB56A9',
    g1: '#4E1764', // градиент кнопок
    g2: '#CB56A9',
    onGrad: '#FFFFFF',
    heroNum: '#4E1764',
    blue: '#1E80C2',
    blueSoft: '#83CDFF',
    plumDeep: '#42085A', // кнопка «Чат»
    moto: '#BEE1EC', // блоки занятий: моторика, речь, мышление
    speech: '#FFE8B3',
    think: '#ECBEDE',
    ringTrack: 'rgba(255,255,255,0.55)',
    profileInk: '#0E4F7D',
    ink: '#2B1430',
    inkSoft: '#6A4A6E',
    inkMute: '#7A5E80',
    line: '#EBD9EA',
    error: '#B4233F',
    errorBg: '#FCE4EA',
    ok: '#1F7A52',
    okBg: '#DDF3E8',
    shadow: 'rgba(78,23,100,0.16)',
  },
  dark: {
    bg: '#140D19',
    surface: '#1E1526',
    pink: '#2F2039',
    pink2: '#271B30',
    pinkInk: '#E6CEE2',
    plum: '#9B52BE',
    magenta: '#E07BC0',
    g1: '#6E2A8C',
    g2: '#D86BB4',
    onGrad: '#FFFFFF',
    heroNum: '#EFC8F8',
    blue: '#2E95D8',
    blueSoft: '#2A5C80',
    plumDeep: '#6E2A8C',
    moto: '#1D3A45',
    speech: '#3D3320',
    think: '#3A2238',
    ringTrack: 'rgba(255,255,255,0.12)',
    profileInk: '#CFE8FF',
    ink: '#F3E9F4',
    inkSoft: '#C6B0CD',
    inkMute: '#9E8AA6',
    line: '#38283F',
    error: '#FF8FA6',
    errorBg: '#3A1824',
    ok: '#6BD3A0',
    okBg: '#14302A',
    shadow: 'rgba(0,0,0,0.55)',
  },
};

export type Colors = (typeof palette)['light'];

export const fonts = {
  head600: 'GolosText_600SemiBold',
  head700: 'GolosText_700Bold',
  body500: 'Manrope_500Medium',
  body600: 'Manrope_600SemiBold',
  body700: 'Manrope_700Bold',
};

export const radius = { l: 30, m: 22, s: 15, pill: 999 };
