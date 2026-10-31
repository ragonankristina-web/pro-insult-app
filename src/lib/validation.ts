// Проверки полей и перевод ошибок сервера на понятный русский.

// Десять цифр номера без кода страны: «+7 999…», «8 999…», «999…» → «999…».
function localDigits(v: string) {
  const d = v.replace(/\D/g, '');
  // Первая 7 или 8 — код страны (российские мобильные номера начинаются с 9).
  return (d[0] === '7' || d[0] === '8' ? d.slice(1) : d).slice(0, 10);
}

// Номер для сервера: «79991234567».
export function normalizePhone(v: string) {
  const local = localDigits(v);
  return local ? '7' + local : '';
}

export function checkPhone(v: string) {
  const d = normalizePhone(v);
  if (!d) return 'Введите номер телефона';
  if (d.length !== 11 || d[0] !== '7') return 'Номер должен содержать 10 цифр после +7';
  if (d[1] !== '9') return 'Нужен номер мобильного телефона: он начинается с +7 9…';
  return null;
}

// Текст поля после ввода. В поле уже стоит «+7», поэтому «8» или «7», набранные по привычке
// в начале (или вставленный номер с кодом страны), не становятся первой цифрой номера.
export function phoneInput(t: string) {
  let d = t.replace(/\D/g, '');
  if (d[0] === '7' && (d[1] === '7' || d[1] === '8')) d = '7' + d.slice(2);
  return d.length <= 1 ? '+7 ' : formatPhone(d);
}

// «79991234567» → «+7 999 123-45-67» — для показа, пока человек печатает.
export function formatPhone(v: string) {
  const d = localDigits(v);
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
  let out = '+7';
  if (p[0]) out += ' ' + p[0];
  if (p[1]) out += ' ' + p[1];
  if (p[2]) out += '-' + p[2];
  if (p[3]) out += '-' + p[3];
  return out;
}

export function checkName(v: string) {
  const s = v.trim();
  if (!s) return 'Введите имя и фамилию';
  if (s.length < 2) return 'Слишком короткое имя';
  if (s.length > 120) return 'Слишком длинное имя';
  return null;
}

export function ruAuthError(raw: string | undefined | null) {
  const m = (raw ?? '').toLowerCase();
  if (!m) return 'Что-то пошло не так. Попробуйте ещё раз.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('expired'))
    return 'Код устарел или неверный. Запросите новый.';
  if (m.includes('invalid') && (m.includes('token') || m.includes('otp'))) return 'Неверный код. Проверьте цифры.';
  if (m.includes('invalid phone') || m.includes('phone number')) return 'Сервер не принял этот номер телефона';
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many'))
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  if (m.includes('sms') && (m.includes('send') || m.includes('provider')))
    return 'Не удалось отправить код. Попробуйте ещё раз через минуту.';
  if (m.includes('signups not allowed')) return 'Регистрация временно закрыта';
  if (m.includes('network') || m.includes('failed to fetch')) return 'Нет связи с сервером. Проверьте интернет.';
  return raw?.replace(/^ERROR:\s*/i, '') ?? 'Что-то пошло не так';
}
