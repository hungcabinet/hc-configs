# Project Brief — hc-configs

## Назначение

`hc-configs` — генератор персональных VPN-конфигов и ссылок для нескольких клиентов (hc-box, sing-box, Throne, Telegram).  
Проект читает исходники из `data/src`, валидирует/парсит их, генерирует артефакты в `data/dst`, строит пользовательский HTML-портал и при необходимости синхронизирует его через `rsync`.

`readme.md`: `For personal use only`.

## Запуск

```bash
node index.js
```

- Runtime: Node.js ESM (`"type": "module"`).
- Зависимости: `deepmerge`, `twig`, `base64url`.
- Ошибки конфигурации (`CONFIG_*`) завершают процесс с кодом `1`.
- Ошибки парсинга входных файлов аккумулируются в `utils/report.js`; при наличии `error` процесс также завершает с кодом `1`.

## Поток данных

`data/src/{server}/{user}` + `data/src/{server}/naiveproxy*.json`  
→ `utils/files.js:getUserFiles()` (с учётом `layout` обработчика)  
→ `protocolRegistry.findHandler()`  
→ `protocolHandlers.*` + `platformPipeline.*`  
→ `data/dst/users/{user}/{server}/{platform}` + `users/{user}/index.html`.

## Поддерживаемые типы источников

- `vless*.link` (`layout: per-user`) → parser `utils/parsers/vless.js`.
- `awg*.conf` (`layout: per-user`) → parser `utils/parsers/awg.js`.
- `naiveproxy*.json` (`layout: server-shared`) → parser `utils/parsers/naiveproxy.js`, пользователи извлекаются из Caddy `forward_proxy`.
- `mieru*.yaml|yml` (`layout: server-shared`) → parser `utils/parsers/mieru.js`, пользователи извлекаются из `listeners[type=mieru].users`.
- `telegram*.link` (`layout: per-user`) → прямой обработчик в `protocolHandlers.generateTelegram`.

## Целевые платформы

- `android`: конфиги `tun`, `hybrid`, `socks` + `sing-box://import-remote-profile`.
- `ios`: sing-box `tun` (для outbound-протоколов) или `.conf` копия (для AWG).
- `windows`: `.link` файлы + общий `subscriptions.txt` + routing (`direct-rules.txt`, `proxy-rules.txt`).
- `raw`: сырой outbound JSON и дополнительные исходники (например, `.link`/`.conf`).
- `telegram`: deep link (и общий socks-link для `common/android`).

## Конфигурация

- Пользовательский конфиг: `configs/config.json` (обязателен).
- Шаблоны/статические файлы: `defaultConfigs/*`, с override через `configs/*` (`utils/config.js:getConfigPath`).
- Ключевые секции `config.json`: `files`, `socks`, `vpnServers.default`, `vpnServers.servers`, `webServer`, `rsync`.
- Sing-box маршрутизация: `defaultConfigs/routing.sing-box.json` (override: `configs/routing.sing-box.json`).
- Sing-box базовый шаблон: `template.sing-box.json`, inbounds: `inbound.*.sing-box.json`.
- Для `mieru` endpoint берётся из `vpnServers.*.mieru.ip`; если IP не задан, используется `listen` из `listeners[type=mieru]` входного yaml.

## Маршрутизация sing-box

Данные в `routing.sing-box.json` собираются в runtime через `utils/routingData.js`:

- **dns** — серверы и теги `directServer` / `defaultServer`
- **apps** — `{ direct: [...], proxy: [...] }` (Android package names)
- **lists** — grouped remote `.srs` URL: `direct|proxy` → `cidrs|domains` → массив URL
- **rulesetDownload** — `{ default: "direct", proxy: [urls] }` для `download_detour` при скачивании ruleset (исключения должны быть в `lists`)

Throne `direct-rules.txt` / `proxy-rules.txt` строятся из тех же данных. Внутренние URL (origin = `webServer.baseUrl`) получают basic-auth per-user.

Подробный формат — `conventions.md` и раздел 4 в `readme.md`.

## Деплой

- Генерация всегда пишет в `data/dst`.
- Если `rsync.enabled = true`, вызывается `utils/rsync.js:syncDstFiles`.
- Веб-ассеты (`site.css`, `site.js`, `docs/for-users.pdf`) копируются в `data/dst/site` и `data/dst/docs`.
