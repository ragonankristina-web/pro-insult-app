import { useCallback, useEffect, useState } from 'react';

import { supabase, type Link } from './supabase';

// Связи с другими людьми: список, запрос по номеру, ответ на входящий запрос, удаление.
export function useLinks(enabled: boolean) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('my_links');
    setLinks((data as Link[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    supabase.rpc('my_links').then(({ data }) => {
      if (!alive) return;
      setLinks((data as Link[] | null) ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  const request = useCallback(async (number: string) => {
    const { data, error } = await supabase.rpc('request_link', { p_number: number });
    if (error) return { error: cleanError(error.message) };
    await reload();
    const row = (data as { full_name: string; role: string }[] | null)?.[0];
    return { name: row?.full_name ?? '' };
  }, [reload]);

  const respond = useCallback(async (id: number, accept: boolean) => {
    const { error } = await supabase.rpc('respond_link', { p_id: id, p_accept: accept });
    await reload();
    return error ? cleanError(error.message) : null;
  }, [reload]);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase.rpc('remove_link', { p_id: id });
    await reload();
    return error ? cleanError(error.message) : null;
  }, [reload]);

  return { links, loading, reload, request, respond, remove };
}

// Сообщения из функций базы уже на русском; убираем служебный префикс, если он есть.
function cleanError(m: string) {
  if (/failed to fetch|network/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.';
  return m.replace(/^ERROR:\s*/i, '');
}
