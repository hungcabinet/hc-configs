# hc-configs

Генератор персональных VPN-конфигов и ссылок для разных платформ с публикацией на приватный веб-сайт.

For personal use only.

Репозиторий: [hc-configs](https://github.com/hungcabinet/hc-configs)  
Origin remote: `git@github.com:hungcabinet/hc-configs.git`

## 1) Что поддерживается

### Протоколы (входные источники)

- `vless*.link`
- `awg*.conf` (AmneziaWG)
- `naiveproxy*.json` (Caddy `forward_proxy`)
- `mieru*.yaml` / `mieru*.yml` / `mihomo*.yaml` / `mihomo*.yml`
- `telegram*.link`

### Платформы (выходные артефакты)

- `android`:
  - `*-tun.json`
  - `*-hybrid.json` (TUN + SOCKS)
  - `*-socks.json`
  - subscription-ссылки для `hc-box` (`sing-box://import-remote-profile`)
- `ios`:
  - `*-tun.json` для `sing-box`
  - для AWG также копия `*.conf` (подходит для `AmneziaVPN` / `AmneziaWG`)
- `windows`:
  - `*.link` для `Throne`
  - общий `subscriptions.txt`
  - `direct-rules.txt` и `proxy-rules.txt`
- `raw`:
  - `*-outbound.json` (или `*-https-outbound.json` для naive-https)
  - дополнительные исходники (`*.link`, `*.conf`)
- `telegram`:
  - deep-link и файл-ссылка

### Клиенты

- Android: `hc-box` (через конфиги и subscription links)
- iOS: `sing-box`, `AmneziaVPN`, `AmneziaWG`
- Windows: `Throne`
- Telegram: Telegram Proxy deep links
- Universal / advanced: кастомные конфиги `sing-box` / `hc-box` из `raw`

---

## 2) Как использовать в Linux для генерации и заливки на сайт

Ниже минимальный рабочий сценарий для Linux-сервера/CI-хоста.

### Шаг 1. Подготовить окружение

Установите:

- Node.js 18+ (или новее)
- `npm`
- `rsync`
- SSH-доступ до web-сервера (обычно по ключу)

Пример (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y nodejs npm rsync openssh-client
```

### Шаг 2. Установить проект

```bash
git clone <your-repo-url> hc-configs
cd hc-configs
npm install
```

### Шаг 3. Создать рабочий конфиг

```bash
mkdir -p configs
cp defaultConfigs/config.json.sample configs/config.json
```

Отредактируйте `configs/config.json`:

1. `files.sourceDirectoryPath` и `files.destinationDirectoryPath` (если нужны нестандартные пути)
2. `vpnServers.default` и `vpnServers.servers`
3. `webServer` (обязательно, если нужен HTML-портал и корректные ссылки)
4. `rsync` (для автозаливки на удалённый сервер)

Минимальный пример секции деплоя:

```json
{
  "vpnServers": {
    "default": {
      "naiveproxy": {
        "useQuic": false
      },
      "mieru": {
        "ip": "198.51.100.10"
      }
    },
    "servers": {
      "server-main": {
        "name": "Main server",
        "naiveproxy": {
          "ip": "198.51.100.11",
          "useQuic": true
        },
        "mieru": {
          "ip": "198.51.100.11"
        }
      }
    }
  },
  "rsync": {
    "enabled": true,
    "host": "configs-host.example",
    "destination": "/var/www/html/config-site/",
    "user": "deploy"
  },
  "webServer": {
    "enabled": true,
    "baseUrl": "https://configs.example.com",
    "users": [
      { "userName": "user-001", "password": "change-me" }
    ],
    "sshAuth": {
      "enabled": false,
      "host": "configs-host.example",
      "user": "deploy",
      "htpasswdPath": "/etc/nginx/.htpasswd"
    }
  }
}
```

### Разделы `configs/config.json` и их назначение

- `files`
  - `sourceDirectoryPath`: путь к входным данным (`data/src` по умолчанию).
  - `destinationDirectoryPath`: путь к выходным данным (`data/dst` по умолчанию).
- `socks`
  - базовые параметры socks-профиля, который добавляется в общие Telegram/клиентские ссылки.
- `vpnServers`
  - `default`: значения по умолчанию для всех серверов.
  - `servers.<serverName>`: переопределения для конкретного сервера.
  - `name`: отображаемое имя сервера в веб-интерфейсе.
  - `naiveproxy.ip` / `naiveproxy.useQuic`: параметры для генерации naive-профилей.
  - `mieru.ip`: endpoint для `mieru`; если не задан, используется `listen` из входного yaml.
- `rsync`
  - автоматическая синхронизация `data/dst` на удалённый хост после генерации.
  - ключи: `enabled`, `host`, `destination`, `user`.
- `webServer`
  - включает генерацию ссылок с публичным `baseUrl`.
  - `users`: список пользователей для встраивания basic-auth в ссылки (файлы на сайте, subscription URL, **внутренние URL ruleset** в sing-box и Throne).
  - `sshAuth`: автоматическое создание/обновление пользователей в удалённом `.htpasswd` через SSH.
    - `enabled`: включить/выключить.
    - `host`: SSH-хост для подключения.
    - `user`: SSH-пользователь для подключения.
    - `htpasswdPath`: путь к файлу паролей на удалённом сервере.
    - **Важно**: Первый пользователь должен быть создан вручную с флагом `-c` (см. раздел 4, шаг 2).

### Override sing-box конфигов

Файлы из `defaultConfigs/` можно переопределить, положив копию в `configs/` (полная замена файла):

| Файл | Назначение |
|------|------------|
| `routing.sing-box.json` | DNS, приложения, remote ruleset lists |
| `template.sing-box.json` | Базовый каркас sing-box (log, outbounds, experimental) |
| `inbound.socks.sing-box.json` | SOCKS inbound |
| `inbound.tun.sing-box.json` | TUN inbound |

### Шаг 4. Подготовить входные данные

Структура `data/src`:

```text
data/src/
  <server>/
    <user>/
      vless*.link
      awg*.conf
      telegram*.link
    naiveproxy*.json
    mieru*.yaml
```

Пример:

```text
data/src/server-main/user-001/vless-main.link
data/src/server-main/user-001/awg-main.conf
data/src/server-main/user-001/telegram-main.link
data/src/server-main/naiveproxy-main.json
data/src/server-main/mihomo-main.yaml
```

### Описание входных конфигов (что это и откуда брать)

- `vless*.link`
  - Что это: VLESS URI-ссылки для outbound.
  - Откуда брать: Копируем из 3x-ui панели
- `awg*.conf`
  - Что это: конфиг AmneziaWG/WireGuard для endpoint-профилей.
  - Откуда брать: Это обычный AmneziaWG конфиг. Не в формате для приложения AmneziaVPN, а в WG формате
- `telegram*.link`
  - Что это: готовая Telegram proxy/deep-link.
  - Откуда брать: Получаем из веб панели Telemt или вставляем любую ссылку на mtproto
- `naiveproxy*.json`
  - Что это: JSON-конфиг Caddy с `forward_proxy` роутами и auth-пользователями.
  - Откуда брать: Выполняем на сервере команду:
  ```
  docker run --rm -v /etc/hungcabinet/naiveproxy:/config pocat/naiveproxy:latest-uot   caddy adapt --config /config/Caddyfile --adapter caddyfile --pretty > /etc/hungcabinet/naiveproxy/config.json
  ```
  берём файл `/etc/hungcabinet/naiveproxy/config.json`

- `mieru*.yaml` / `mihomo*.yaml`
  - Что это: YAML-конфиг c `listeners` (`type: mieru`) и `users`.
  - Откуда брать: файл конфига mihomo с mieru листенером без изменений

### Шаг 5. Запустить генерацию

```bash
node index.js
```

Что произойдёт:

- конфиги будут собраны в `data/dst`
- для каждого пользователя будет собран `index.html`
- будут скопированы веб-ассеты (`site.css`, `site.js`, `docs/for-users.pdf`, `docs/for-admins.pdf`)
- если `rsync.enabled = true`, содержимое `data/dst` автоматически синхронизируется на сервер

### Шаг 6. Проверить результат

- локально: `data/dst/users/<user>/index.html`
- на сервере: откройте `webServer.baseUrl`
- в логах генерации: блок `=== Отчёт генерации ===`

### Шаг 7. Автоматизировать (опционально)

Самый простой вариант через cron:

```bash
crontab -e
```

Пример задачи каждые 30 минут:

```cron
*/30 * * * * cd /opt/hc-configs && /usr/bin/node index.js >> /var/log/hc-configs.log 2>&1
```

---

## 3) Маршрутизация sing-box и Throne

Маршрутизация **не зашита** в монолитный JSON. Данные в `defaultConfigs/routing.sing-box.json` (или `configs/routing.sing-box.json`) собираются в runtime модулем `utils/routingData.js`.

### Структура `routing.sing-box.json`

```json
{
  "dns": {
    "directServer": "yandex",
    "defaultServer": "google",
    "servers": [ "..." ]
  },
  "apps": {
    "direct": [ "com.vkontakte.android" ],
    "proxy": []
  },
  "rulesetDownload": {
    "default": "direct",
    "proxy": []
  },
  "lists": {
    "direct": {
      "cidrs": [ "https://example.com/routing/direct.srs" ],
      "domains": [ "https://example.com/routing/apple.srs" ]
    },
    "proxy": {
      "domains": [ "https://example.com/routing/youtube.srs" ]
    }
  }
}
```

- **lists** — remote `.srs` URL, сгруппированные по `direct`/`proxy` и `cidrs`/`domains`. Пустые группы можно не указывать.
- **apps** — Android package names; `direct` и `proxy` маршрутизируются отдельно (iOS-конфиги rules с `package_name` не получают).
- **rulesetDownload** — через какой outbound sing-box **скачивает** ruleset (`download_detour`). По умолчанию `direct`; исключения — URL в массиве `proxy` (должны быть и в `lists`).
- **dns** — резолверы и правила: direct-трафик → `directServer`, остальное → `defaultServer`.

### Именование ruleset

Тег вычисляется автоматически: `{source}-{basename}-{type}`

- `https://…/routing/hydraponique/geosite/youtube.srs` → `hydraponique-youtube-domains`
- `https://…/routing/hungcabinet/sing-box/cidrs/asn/v4/AS13335.srs` → `hungcabinet-AS13335-cidrs`

### Порядок route rules

1. apps → direct  
2. direct cidrs → direct  
3. direct domains → direct  
4. apps → proxy  
5. proxy cidrs → proxy  
6. proxy domains → proxy  

### Throne (Windows)

`direct-rules.txt` и `proxy-rules.txt` строятся из тех же `lists` (строки `ruleset:<url>`). Приложения в Throne rules не попадают.

### Basic-auth во внутренних ruleset URL

Если URL ruleset имеет тот же origin, что `webServer.baseUrl`, при генерации для каждого пользователя в URL встраивается basic-auth (логин/пароль из `webServer.users`). В конфиге URL хранятся **без** credentials. Внешние URL (другой origin) не меняются.

---

## 4) Базовая инструкция по настройке своего сервера с сайтом

В репозитории есть пример: `defaultConfigs/nginx.conf.sample`.

Ниже базовый план.

### Шаг 1. Установить Nginx и создать каталог сайта

```bash
sudo apt update
sudo apt install -y nginx apache2-utils
sudo mkdir -p /var/www/html/config-site
sudo chown -R www-data:www-data /var/www/html/config-site
```

### Шаг 2. Настроить basic auth

`nginx.conf.sample` использует:

- `auth_basic "Files Access";`
- `auth_basic_user_file /etc/nginx/.htpasswd;`
- `alias /var/www/html/config-site/users/$remote_user/;`

Создайте пользователей:

```bash
# Первый пользователь создаётся с флагом -c (создать файл)
sudo htpasswd -c /etc/nginx/.htpasswd user-001
# Последующие пользователи добавляются без флага -c
sudo htpasswd /etc/nginx/.htpasswd user-002
```

**Важно**: Если вы используете функцию `sshAuth` в конфиге, файл `.htpasswd` должен быть создан заранее хотя бы с одним пользователем через флаг `-c`. Автоматика использует флаг `-b` для обновления/добавления, который не создает файл с нуля.

Важно: имена в `.htpasswd` должны совпадать с именами директорий пользователей (`data/dst/users/<user>`), иначе `alias .../$remote_user/` не найдёт файлы.

### Шаг 3. Подключить TLS сертификат

В конфиге используются:

- `ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;`
- `ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;`

Обычно сертификат получают через certbot.

### Шаг 4. Подключить nginx-конфиг

1. Скопируйте `defaultConfigs/nginx.conf.sample`
2. Замените:
  - `server_name`
  - пути сертификатов
  - (при необходимости) `root`
3. Сохраните как site-конфиг, например:
  - `/etc/nginx/sites-available/config-site.conf`
4. Включите сайт:

```bash
sudo ln -s /etc/nginx/sites-available/config-site.conf /etc/nginx/sites-enabled/config-site.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 5. Проверка

- откройте `https://<ваш-домен>/`
- Nginx запросит логин/пароль (basic auth)
- после входа пользователь должен видеть только свой каталог конфигов
- статические файлы должны открываться:
  - `https://<домен>/site/site.css`
  - `https://<домен>/docs/for-users.pdf`
  - `https://<домен>/docs/for-admins.pdf`

### Рекомендации по безопасности

- Используйте отдельного пользователя для `rsync` (например, `deploy`), без shell-доступа при необходимости.
- Ограничьте SSH-доступ по ключам и IP (доступ без авторизации по ключу все равно работать не будет).
- Не храните реальные пароли в `defaultConfigs/config.json.sample`.
- Добавьте ротацию логов для cron/systemd задач генерации.

---

## Быстрый чек-лист запуска

1. `npm install`
2. `cp defaultConfigs/config.json.sample configs/config.json`
3. Заполнить `configs/config.json` (`webServer`, `vpnServers`, `rsync`)
4. При необходимости: `cp defaultConfigs/routing.sing-box.json configs/routing.sing-box.json` и настроить lists
5. Положить входные файлы в `data/src/...`
6. `node index.js`
7. Проверить `data/dst` и публикацию через Nginx