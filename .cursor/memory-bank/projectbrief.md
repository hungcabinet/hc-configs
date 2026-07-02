# Project Brief — hc-configs

## Назначение

`hc-configs` — генератор персональных VPN-конфигов и ссылок для нескольких клиентов (hc-box/sing-box, Clash/mihomo, Throne, Telegram).  
Проект читает исходники из `data/src`, валидирует/парсит их, генерирует артефакты в `data/dst`, строит пользовательский HTML-портал и при необходимости синхронизирует его через `rsync`.

`readme.md`: `For personal use only`.

## Запуск

```bash
node index.js
```

- Runtime: Node.js ESM (`"type": "module"`).
- Зависимости: `deepmerge`, `twig`, `base64url`, `js-yaml`.
- Ошибки конфигурации (`CONFIG_*`) завершают процесс с кодом `1`.
- Ошибки парсинга входных файлов аккумулируются в `utils/report.js`; при наличии `error` процесс также завершает с кодом `1`.

## Поток данных

`data/src/{server}/{user}` + `data/src/{server}/naiveproxy*.json` + `data/src/{server}/mieru*.yaml`  
→ `utils/files.js:getUserFiles()` (с учётом `layout` обработчика)  
→ `protocolRegistry.findHandler()` → `handler.generate()`  
→ `platformPipeline.run()`  
→ `data/dst/users/{user}/{server}/{platform}` + `users/{user}/index.html`.

## Поддерживаемые типы источников

- `vless*.link` (`layout: per-user`) → sing-box outbound + mihomo proxy.
- `awg*.conf` (`layout: per-user`) → sing-box endpoint + mihomo wireguard.
- `naiveproxy*.json` (`layout: server-shared`) → sing-box outbound; mihomo не поддерживается.
- `mieru*.yaml|yml` / `mihomo*.yaml|yml` (`layout: server-shared`) → sing-box + mihomo mieru proxy.
- `telegram*.link` (`layout: per-user`) → Telegram deep link.

## Целевые платформы

- **android** (hc-box / sing-box): конфиги `tun`, `hybrid`, `socks` + `sing-box://import-remote-profile`.
- **android-clash** (Clash/mihomo): только TUN yaml + `clash://install-config?url=...&name=...`.
- **ios**: TUN yaml для Clash/mihomo (vless, mieru, awg); для AWG дополнительно копия `.conf` (AmneziaVPN/AmneziaWG).
- **windows**: `.link` файлы + общий `subscriptions.txt` + routing (`direct-rules.txt`, `proxy-rules.txt`).
- **raw**: sing-box outbound JSON, mihomo proxy yaml (per-protocol + aggregated `all-proxies`), дополнительные `.link`/`.conf`.
- **telegram**: deep link (и общий socks-link для `common/android`).

## Конфигурация

- Пользовательский конфиг: `configs/config.json` (обязателен).
- Шаблоны/статические файлы: `defaultConfigs/*`, с override через `configs/*` (`utils/config.js:getConfigPath`).
- Ключевые секции `config.json`: `files`, `socks`, `vpnServers.default`, `vpnServers.servers`, `webServer`, `rsync`.
- Sing-box: `template.sing-box.json`, `inbound.*.sing-box.json` (override: `configs/`).
- Mihomo/Clash: `template.mihomo.yaml` (override: `configs/`).
- Throne rules: `throne.direct.txt`, `throne.proxy.txt` (override: `configs/`).
- Для `mieru` endpoint берётся из `vpnServers.*.mieru.ip`; если IP не задан, используется `listen` из `listeners[type=mieru]` входного yaml.

## Маршрутизация

- **template.sing-box.json** — sing-box конфиг; auth в URL ruleset; дополняется outbounds/endpoints/inbounds протоколов.
- **template.mihomo.yaml** — mihomo конфиг с TUN; auth в `rule-providers[].header.Authorization`; proxy `name: proxy` в группе `PROXY`; iOS без PROCESS-NAME правил.
- **throne.direct.txt / throne.proxy.txt** — правила Throne; копируются в per-user `direct-rules.txt` / `proxy-rules.txt` с auth enrichment.

Внутренние URL (origin = `webServer.baseUrl`) получают basic-auth per-user через `utils/urlAuth.js`.

## Деплой

- Генерация всегда пишет в `data/dst`.
- Если `rsync.enabled = true`, вызывается `utils/rsync.js:syncDstFiles`.
- Веб-ассеты (`site.css`, `site.js`, `docs/for-users.pdf`, `docs/for-admins.pdf`) копируются в `data/dst/site` и `data/dst/docs`.
