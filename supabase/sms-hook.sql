-- PRO Инсульт · отправка кода входа в СМС через SMS.ru прямо из базы (Send SMS Hook сервера входа).
-- Выполнять целиком; повторно — можно.
-- Ключ SMS.ru хранится в зашифрованном хранилище Vault под именем smsru_api_id и кладётся туда отдельно:
--   select vault.create_secret('<api_id>', 'smsru_api_id', 'Ключ API SMS.ru');

create extension if not exists pg_net with schema extensions;

create or replace function public.send_sms_hook(event jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  phone text := regexp_replace(coalesce(event -> 'user' ->> 'phone', ''), '\D', '', 'g');
  otp text := coalesce(event -> 'sms' ->> 'otp', '');
  api_id text;
begin
  select decrypted_secret into api_id from vault.decrypted_secrets where name = 'smsru_api_id' limit 1;
  if api_id is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'SMS provider is not configured'));
  end if;
  -- Только российские мобильные номера и цифровой код.
  if phone !~ '^79\d{9}$' or otp !~ '^\d{4,10}$' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Invalid phone or code'));
  end if;
  -- Запрос уходит в фоне; итог каждой отправки виден в net._http_response.
  perform net.http_get(
    url := 'https://sms.ru/sms/send',
    params := jsonb_build_object(
      'api_id', api_id,
      'to', phone,
      'msg', 'PRO Инсульт: код входа ' || otp || '. Никому его не сообщайте.',
      'json', '1'
    ),
    timeout_milliseconds := 10000
  );
  return '{}'::jsonb;
end;
$$;

-- Вызывать функцию может только сервер входа.
revoke execute on function public.send_sms_hook(jsonb) from public, anon, authenticated;
grant execute on function public.send_sms_hook(jsonb) to supabase_auth_admin;
