import { useAuth } from './Auth';
import { useLinks } from './links';
import type { Link } from './supabase';

// Кто на другой стороне у текущего пользователя — по подтверждённым связям.
// Пока связи нет, экраны показывают людей из демо-данных макета.
export function usePeople() {
  const { profile } = useAuth();
  const { links, loading } = useLinks(Boolean(profile));
  const accepted = links.filter((l) => l.status === 'accepted');
  const of = (role: Link['other_role']) => accepted.filter((l) => l.other_role === role);
  return { loading, doctor: of('doctor')[0] ?? null, patients: of('patient'), caregivers: of('caregiver') };
}
