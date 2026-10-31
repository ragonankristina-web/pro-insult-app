#!/usr/bin/env bash
# Установка сервера PRO Инсульт на чистую Ubuntu 24.04 (запускать от root).
#   bash setup.sh <домен>          например: bash setup.sh 51-250-10-20.sslip.io
# Повторный запуск безопасен: ключи и данные не пересоздаются.
set -euo pipefail

DOMAIN="${1:?Укажите домен сервера}"
FILES="$(cd "$(dirname "$0")" && pwd)"   # здесь лежат override, Caddyfile, *.sql
ROOT=/opt/pro-insult
VERSION=self-hosted/v0.8.3

echo "== Обновления системы и базовая защита"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq git curl ufw unattended-upgrades fail2ban
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
systemctl enable --now fail2ban

echo "== Подкачка 2 ГБ (запас памяти для сервера с 4 ГБ)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Docker"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
command -v node >/dev/null || apt-get install -yq nodejs   # нужен скрипту генерации ключей Supabase

echo "== Supabase $VERSION"
mkdir -p "$ROOT"
cd "$ROOT"
[ -d supabase-src ] || git clone -q --depth 1 --branch "$VERSION" https://github.com/supabase/supabase supabase-src
if [ ! -f supabase/.env ]; then
  mkdir -p supabase
  cp -rf supabase-src/docker/. supabase/
  cd supabase
  cp .env.example .env
  sh utils/generate-keys.sh --update-env >/dev/null
  sh utils/add-new-auth-keys.sh --update-env >/dev/null
  cd ..
fi
cd supabase

set_env() {  # set_env КЛЮЧ ЗНАЧЕНИЕ — заменить или добавить строку в .env
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
set_env PRO_INSULT_DOMAIN "$DOMAIN"
set_env SUPABASE_PUBLIC_URL "https://$DOMAIN"
set_env API_EXTERNAL_URL "https://$DOMAIN/auth/v1"
set_env SITE_URL "https://$DOMAIN"
set_env ENABLE_EMAIL_SIGNUP false
set_env ENABLE_PHONE_SIGNUP true
set_env ENABLE_PHONE_AUTOCONFIRM false
set_env DASHBOARD_USERNAME admin
chmod 600 .env

cp "$FILES/docker-compose.override.yml" "$FILES/Caddyfile" .

echo "== Запуск"
docker compose pull -q
docker compose up -d
echo "Ждём готовности базы…"
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do sleep 3; done

echo "== Схема PRO Инсульт"
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$FILES/schema.sql"
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$FILES/sms-hook.sql"
docker compose restart auth

echo "== Ежедневная резервная копия базы (хранятся 14 последних)"
mkdir -p "$ROOT/backups"
cat > /etc/cron.daily/pro-insult-backup <<CRON
#!/bin/sh
cd $ROOT/supabase && docker compose exec -T db pg_dump -U postgres -d postgres -Fc > $ROOT/backups/db-\$(date +%F).dump
ls -1t $ROOT/backups/db-*.dump | tail -n +15 | xargs -r rm -f
CRON
chmod +x /etc/cron.daily/pro-insult-backup

echo "== Готово: https://$DOMAIN"
grep -E '^(SUPABASE_PUBLISHABLE_KEY|ANON_KEY)=' .env | sed 's/^/   /'
