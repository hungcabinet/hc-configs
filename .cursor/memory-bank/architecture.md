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
  singBox.js             # Сборка sing-box: base + routing + inbounds
  routingData.js         # Данные маршрутизации, сборка route/dns для sing-box и Throne
  urlAuth.js             # Basic-auth во внутренних HTTP(S) ссылках
  throne.js              # Throne subscriptions + Windows routing rules
  sourceProfile.js       # profileId из имени файла источника
  report.js              # централизованный warn/error/summary

defaultConfigs/
  template.sing-box.json
  routing.sing-box.json
  inbound.socks.sing-box.json
  inbound.tun.sing-box.json
  config.json.sample
  webSiteTemplate.twig
  ...
```

Удалены старые файлы: `utils/context.js`, `utils/vless.js`, `utils/awg.js`, `utils/naiveproxy.js`, монолитный `singBoxTemplate.json`.

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
   - строятся `direct-rules.txt` и `proxy-rules.txt` в `common/windows` (из `routing.sing-box.json`, per-user auth);
   - рендерится `users/{user}/index.html`.
6. Копируются `site/*` и `docs/for-users.pdf`.
7. При включённом `rsync` выполняется синхронизация.
8. Печатается итоговый отчёт; при ошибках парсинга — `exit(1)`.

## Sing-box: сборка конфига

Конфиг **не хранится целиком** в одном JSON. Сборка в `singBox.getAndroidTemplate(ctx)` / `getIosTemplate(ctx)`:

```
template.sing-box.json          # log, outbounds, route.final, experimental
+ routingData.buildSingBoxRouting(loadRoutingData(), authForUser)
+ outbound/endpoint из парсера протокола
+ inbounds (tun/socks)
```

`routingData.loadRoutingData()` читает `routing.sing-box.json` (override: `configs/routing.sing-box.json`), валидирует и кеширует.

### Маршрутизация (route)

Порядок правил:

1. apps → direct
2. direct cidrs
3. direct domains
4. apps → proxy
5. proxy cidrs
6. proxy domains

Теги remote ruleset: `{source}-{basename}-{type}` (например `hydraponique-youtube-domains`, `hungcabinet-AS13335-cidrs`).

### DNS

- direct domain lists + direct apps → `dns.directServer` (yandex)
- proxy apps → `dns.defaultServer` (google)
- остальное → `dns.defaultServer`

### Basic-auth во внутренних ruleset URL

Если URL ruleset имеет тот же origin, что `webServer.baseUrl`, при генерации для пользователя в URL встраивается basic-auth (`urlAuth.embedBasicAuthInLink`). Применяется в sing-box `route.rule_set[].url` и в Throne `ruleset:...` строках. В `routing.sing-box.json` URL хранятся **без** credentials.

### iOS

`getIosTemplate` удаляет правила с `package_name` из dns/route (Android-only).

## Throne routing

`throne.extractWindowsRoutes(ctx)` строит `direct-rules.txt` / `proxy-rules.txt` **напрямую** из `routing.sing-box.json` через `routingData.buildThroneRoutes()`, без reverse-parse собранного sing-box конфига. Basic-auth — per-user, как для sing-box.

Приложения (`package_name`) в Throne rules **не экспортируются** (ограничение клиента).

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
- Android (`tun`/`hybrid`/`socks`) через `android.processAndroidConfig` + `singBox.getAndroidTemplate(ctx)`;
- iOS sing-box profile или copy `.conf` (для AWG);
- Windows `.link` и `subscriptions.txt` для Throne;
- Telegram deep-link в `common`.

## Отчёт и контроль ошибок

`utils/report.js`:

- собирает `warn` и `error` по файлам/протоколам,
- считает `processed` и `skipped`,
- печатает итоговый summary,
- предоставляет `hasErrors()` для фатального завершения процесса.

Ошибки в `routing.sing-box.json` (`ROUTING_INVALID`) также завершают процесс при загрузке.

## Планируется

- `routing.mihomo.json` — отдельные данные маршрутизации для Mihomo (по аналогии с sing-box).
