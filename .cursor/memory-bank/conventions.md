# Conventions — hc-configs

## Код-стайл и организационные правила

- ESM (`import`/`export default`), синхронный файловый IO в генераторах.
- Русские пользовательские тексты (описания ссылок, ошибки валидации, summary).
- Вместо mutable global context используется immutable `GenerationContext`.
- Парсинг и валидация отделены от генерации:
  - `utils/parsers/*` возвращают `{ success, warnings, errors, ... }`,
  - `utils/protocolHandlers.js` решает, что генерировать.

## Формат входа (`data/src`)

```
data/src/
  {server}/
    {user}/
      vless*.link
      awg*.conf
      telegram*.link
    naiveproxy*.json
    mieru*.yaml
```

- Матчинг файлов и layout задаются в `utils/protocolRegistry.js`, а не в `index.js`.
- Для `server-shared` источников (naiveproxy/mieru) пользователи извлекаются из файла (`extractUsers`).
- Для `mieru` пользователи берутся из `listeners[type=mieru].users` (ключи объекта), endpoint — из `vpnServers.*.mieru.ip` с fallback на `listen`.

## Формат выхода (`data/dst`)

```
data/dst/users/{user}/
  index.html
  meta.json
  common/
    android/
    windows/
      subscriptions.txt
      direct-rules.txt
      proxy-rules.txt
  {server}/
    android/  *-tun.json, *-hybrid.json, *-socks.json
    ios/      *-tun.json или *.conf
    windows/  *.link
    raw/      *-outbound.json, *.link, *.conf
```

## Naming правилa

- Базовое имя: `{server}-{user}-{suffix}`.
- `suffix` строится от `protocol`; при наличии профильного имени применяется `profileId` (`utils/sourceProfile.js` + `files.resolveFileNameSuffix`).
- Это позволяет иметь несколько файлов одного протокола (`vless-main.link`, `vless-backup.link`) без коллизий.

## Веб-ссылки и приоритеты

- Приоритет платформ: `telegram` → `android` → `windows` → `ios` → `raw`.
- Приоритет linkType: `telegram` → `subscription` → `config` → `routing` → `link` → `outbound` → `inbound`.
- Атрибуты ссылок: `open`, `download`, `copy-data`, `copy-link`.

## Конфиг и override

- Основной конфиг обязателен: `configs/config.json`.
- Файловый override: `configs/{relative}` имеет приоритет над `defaultConfigs/{relative}` (полная замена файла, не merge).
- Валидируемые секции в `config.js`: `rsync` (при enabled обязательны host/user/destination), `webServer` (валидный `baseUrl`, корректный `users`).
- Пример задания endpoint для `mieru` в `configs/config.json`:
  - `vpnServers.default.mieru.ip: "203.0.113.10"` (глобально),
  - `vpnServers.servers.{server}.mieru.ip` (переопределение для конкретного сервера).

## Sing-box конфиги (`defaultConfigs/`)

| Файл | Назначение |
|------|------------|
| `routing.sing-box.json` | DNS, apps, remote ruleset lists, download detour |
| `template.sing-box.json` | Минимальный каркас sing-box (без route rules) |
| `inbound.socks.sing-box.json` | SOCKS inbound |
| `inbound.tun.sing-box.json` | TUN inbound |

Override: положить файл с тем же именем в `configs/`.

### Формат `routing.sing-box.json`

```json
{
  "dns": {
    "directServer": "yandex",
    "defaultServer": "google",
    "servers": [ "... sing-box dns servers ..." ]
  },
  "apps": {
    "direct": [ "com.example.app" ],
    "proxy": []
  },
  "rulesetDownload": {
    "default": "direct",
    "proxy": []
  },
  "lists": {
    "direct": {
      "cidrs": [ "https://.../direct.srs" ],
      "domains": [ "https://.../apple.srs" ]
    },
    "proxy": {
      "cidrs": [],
      "domains": [ "https://.../youtube.srs" ]
    }
  }
}
```

- Пустые группы (`cidrs`, `domains`, `direct`, `proxy`) можно опускать.
- Legacy: `apps` как плоский массив → трактуется как `apps.direct`.
- Legacy: `lists` как массив `{ route, type, url }` — поддерживается для старых override.
- Тег ruleset: `{source}-{basename}-{type}` (source — сегмент пути после `/routing/`, basename — имя `.srs` без расширения).
- `rulesetDownload.proxy` — URL, которые скачиваются через `download_detour: "proxy"`; каждый URL должен присутствовать в `lists`.

### Basic-auth

- `utils/urlAuth.js` — если HTTP(S) URL имеет origin = `webServer.baseUrl`, при генерации встраивается `user:password@` из `webServer.users`.
- Применяется к ссылкам на сайте (`webSite.js`) и к ruleset URL в sing-box / Throne (`routingData.js`, per-user).

## Как добавить новый протокол

1. Добавить parser в `utils/parsers/{protocol}.js` с `source` и `to*`.
2. Зарегистрировать его в `utils/protocolRegistry.js` (`pattern`, `layout`, `generate`).
3. Реализовать `generate*` в `utils/protocolHandlers.js`.
4. Использовать `platformPipeline` для платформенных артефактов.
5. Вести валидацию через `report.logValidation` и счётчики `recordProcessed/recordSkipped`.

## Текущие ограничения/риски

- `webServer.writeWebFiles()` ожидает `docs/for-users.pdf`; отсутствие файла вызовет ошибку `copyFileSync`.
- `rsync` логически Linux-oriented (проверять окружение перед включением).
- `configs/` и `data/` не версионируются, поэтому локальная среда обязательна для запуска.
- `routing.mihomo.json` — планируется отдельно от sing-box.
