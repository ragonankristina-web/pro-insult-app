import { Redirect } from 'expo-router';

// Приложение всегда открывается со стартового экрана входа. Если вход уже выполнен,
// там есть кнопка «Продолжить» — без повторного ввода кода.
export default function Index() {
  return <Redirect href="/welcome" />;
}
