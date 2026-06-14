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
- Файловый override: `configs/{relative}` имеет приоритет над `defaultConfigs/{relative}`.
- Валидируемые секции в `config.js`: `rsync` (при enabled обязательны host/user/destination), `webServer` (валидный `baseUrl`, корректный `users`).
- Пример задания endpoint для `mieru` в `configs/config.json`:
  - `vpnServers.default.mieru.ip: "203.0.113.10"` (глобально),
  - `vpnServers.servers.{server}.mieru.ip` (переопределение для конкретного сервера).

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
