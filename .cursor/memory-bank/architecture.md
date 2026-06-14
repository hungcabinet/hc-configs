# Architecture — hc-configs

## Структура (актуальная)

```
utils/
  generationContext.js   # Immutable контекст user/server/protocol/platform/profileId
  protocolRegistry.js    # Реестр обработчиков и source layout
  protocolHandlers.js    # Логика generate* по протоколам
  parsers/
    vless.js             # VLESS -> sing-box outbound + валидация
    awg.js               # AWG conf -> sing-box endpoint + валидация
    naiveproxy.js        # Caddy JSON -> naive outbound + users extractor
    mieru.js             # Mihomo/Mieru YAML -> mieru outbound + users extractor
  platformPipeline.js    # Единый эмиттер артефактов на android/ios/windows/raw/telegram
  sourceProfile.js       # profileId из имени файла источника
  report.js              # централизованный warn/error/summary
```

Удалены старые файлы: `utils/context.js`, `utils/vless.js`, `utils/awg.js`, `utils/naiveproxy.js`.

## Runtime-пайплайн

1. `index.js:mainProcess()` сбрасывает `report`.
2. `files.getUserFiles(commonConfig)` сканирует `data/src`:
   - `per-user` берётся из `{server}/{user}/...`
   - `server-shared` (например naiveproxy/mieru) разворачивается на всех пользователей, найденных парсером.
3. Для каждого пользователя сначала очищаются `common/windows/android/ios/raw` директории.
4. Для каждого файла:
   - ищется handler в `protocolRegistry.findHandler(file.name)`;
   - строится `ctx.withProfile(handler.getProfileId(file.name))`;
   - вызывается `handler.generate(ctx, file)`.
5. После протоколов по каждому пользователю:
   - добавляется `tg://socks` ссылка в `common/android`;
   - строятся `direct-rules.txt` и `proxy-rules.txt` в `common/windows`;
   - рендерится `users/{user}/index.html`.
6. Копируются `site/*` и `docs/for-users.pdf`.
7. При включённом `rsync` выполняется синхронизация.
8. Печатается итоговый отчёт; при ошибках парсинга — `exit(1)`.

## GenerationContext

`GenerationContext` хранит:

- `user`, `server`, `protocol`, `platform`, `profileId`.

Переходы контекста делаются через copy-on-write:

- `withProfile()`, `withProtocol()`, `withPlatform()`, `forCommon()`.

Вспомогательные методы:

- `dir(platform?)`, `getWinDir()/getAndroidDir()/...`,
- `displayProtocol()` (использует `profileId`, если задан),
- `serverDisplayName()` (через `config.getVpnServerConfig`).

## Протокольный слой

`protocolRegistry.handlers` описывает каждый протокол:

- `pattern` (какие файлы матчить),
- `layout` (`per-user` или `server-shared`),
- `extractUsers` (для `server-shared`),
- `getProfileId`,
- `generate`.

`protocolHandlers`:

- `generateVless` — парсит ссылку, валидирует, эмитит multi-platform артефакты.
- `generateAwg` — парсит `.conf`, эмитит endpoint-конфиги и Throne-подписку.
- `generateNaiveproxy` — генерирует `naive-https` и, опционально, `naive-quic`.
- `generateMieru` — читает `listeners[type=mieru]` из yaml, берёт endpoint из `vpnServers.*.mieru.ip` или fallback `listen`.
- `generateTelegram` — добавляет Telegram proxy link.

## Платформенный эмиттер

`platformPipeline` централизует повторяющиеся шаги:

- raw outbound + дополнительные raw файлы;
- Android (`tun`/`hybrid`/`socks`) через `android.processAndroidConfig`;
- iOS sing-box profile или copy `.conf` (для AWG);
- Windows `.link` и `subscriptions.txt` для Throne;
- Telegram deep-link в `common`.

## Отчёт и контроль ошибок

`utils/report.js`:

- собирает `warn` и `error` по файлам/протоколам,
- считает `processed` и `skipped`,
- печатает итоговый summary,
- предоставляет `hasErrors()` для фатального завершения процесса.
