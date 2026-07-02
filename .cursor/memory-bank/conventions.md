# Conventions — hc-configs

## Код-стайл и организационные правила

- ESM (`import`/`export default`), синхронный файловый IO в генераторах.
- Русские пользовательские тексты (описания ссылок, ошибки валидации, summary).
- Вместо mutable global context используется immutable `GenerationContext`.
- Парсинг и валидация отделены от генерации:
  - `utils/parsers/*` возвращают `{ success, warnings, errors, mihomoEntity?, singBoxEntity?, ... }`,
  - `utils/protocolRegistry.js` (inline `generate`) решает, что генерировать через `plan()` + `platformPipeline.run()`.

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
    mihomo*.yaml
```

- Матчинг файлов и layout задаются в `utils/protocolRegistry.js`, а не в `index.js`.
- Для `server-shared` источников (naiveproxy/mieru) пользователи извлекаются из файла (`extractUsers`).
- Для `mieru`/`mihomo` пользователи берутся из `listeners[type=mieru].users` (ключи объекта), endpoint — из `vpnServers.*.mieru.ip` с fallback на `listen`.

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
    android/         *-tun.json, *-hybrid.json, *-socks.json
    android-clash/   *-tun.yaml
    ios/             *-tun.yaml, *.conf (AWG)
    windows/         *.link
    raw/             *-outbound.json, *-proxy.yaml, *-all-proxies.yaml, *.link, *.conf
```

## Naming правила

- Базовое имя: `{server}-{user}-{suffix}`.
- `suffix` строится от `protocol`; при наличии профильного имени применяется `profileId` (`utils/sourceProfile.js` + `files.resolveFileNameSuffix`).
- Это позволяет иметь несколько файлов одного протокола (`vless-main.link`, `vless-backup.link`) без коллизий.

## Веб-ссылки и приоритеты

- Приоритет платформ: `telegram` → `android` → `android-clash` → `windows` → `ios` → `raw`.
- Приоритет linkType: `telegram` → `subscription` → `config` → `routing` → `link` → `outbound` → `inbound` → `proxy`.
- Атрибуты ссылок: `open`, `download`, `copy-data`, `copy-link`.
- **android-clash**: config — `download` + `copy-data`; subscription — `clash://` (open).
- **iOS mihomo**: config — только `download` + `copy-link`.

## Конфиг и override

- Основной конфиг обязателен: `configs/config.json`.
- Файловый override: `configs/{relative}` имеет приоритет над `defaultConfigs/{relative}` (полная замена файла, не merge).
- Валидируемые секции в `config.js`: `rsync` (при enabled обязательны host/user/destination), `webServer` (валидный `baseUrl`, корректный `users`).
- Пример задания endpoint для `mieru` в `configs/config.json`:
  - `vpnServers.default.mieru.ip: "203.0.113.10"` (глобально),
  - `vpnServers.servers.{server}.mieru.ip` (переопределение для конкретного сервера).

## Override-файлы (`defaultConfigs/`)

| Файл | Назначение |
|------|------------|
| `template.sing-box.json` | Полный sing-box конфиг (DNS, route, rule_set, outbounds) |
| `template.mihomo.yaml` | Полный mihomo конфиг (TUN, proxy-groups, rules, rule-providers) |
| `throne.direct.txt` | Direct rules для Throne (`ruleset:<url>` на строку) |
| `throne.proxy.txt` | Proxy rules для Throne |
| `inbound.socks.sing-box.json` | SOCKS inbound |
| `inbound.tun.sing-box.json` | TUN inbound |

Override: положить файл с тем же именем в `configs/`.

### Basic-auth

**sing-box / Throne / ссылки на сайте:**
- `utils/urlAuth.js` — если HTTP(S) URL имеет origin = `webServer.baseUrl`, при генерации встраивается `user:password@` из `webServer.users`.
- Применяется к ссылкам на сайте, URL в sing-box template и строкам Throne rules.

**mihomo rule-providers:**
- URL **не меняется**; для внутренних origin добавляется `header.Authorization: ['Basic ...']` в объект rule-provider.

**iOS mihomo:**
- При чтении `template.mihomo.yaml` удаляются правила `PROCESS-NAME` и `PROCESS-NAME-REGEX`.

## Mihomo client config

- Прокси вставляется в `proxies` с `name: proxy`.
- Прокси добавляется в группу `PROXY` (`proxy-groups[].name === 'PROXY'`).
- Подписка android-clash: `clash://install-config?url={encodedUrl}&name={encodedName}`.

## Как добавить новый протокол

1. Добавить parser в `utils/parsers/{protocol}.js` с `source`, `parseData` и при необходимости `mihomoEntity`.
2. Зарегистрировать handler в `utils/protocolRegistry.js` (`pattern`, `layout`, `generate`).
3. В `generate` вызвать `platformPipeline.run()` с нужным `plan({ android, androidClash, iosMihomo, ... })`.
4. При необходимости добавить writer в `platformPipeline.js`.
5. Вести валидацию через `report.logValidation` и счётчики `recordProcessed/recordSkipped`.

## Текущие ограничения/риски

- `webServer.writeWebFiles()` ожидает `docs/for-users.pdf` и `docs/for-admins.pdf`; отсутствие файла вызовет ошибку `copyFileSync`.
- `rsync` логически Linux-oriented (проверять окружение перед включением).
- `configs/` и `data/` не версионируются, поэтому локальная среда обязательна для запуска.
- Mihomo/Clash конфиги генерируются только в TUN-режиме (без hybrid/socks вариантов).
- naiveproxy не конвертируется в mihomo proxy.
