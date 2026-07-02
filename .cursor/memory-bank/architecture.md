# Architecture — hc-configs

## Структура (актуальная)

```
utils/
  generationContext.js   # Immutable контекст user/server/protocol/platform/profileId
  protocolRegistry.js    # Реестр обработчиков, plan() и inline generate()
  parsers/
    vless.js             # VLESS -> sing-box outbound + mihomo proxy + валидация
    awg.js               # AWG conf -> sing-box endpoint + mihomo wireguard + валидация
    naiveproxy.js        # Caddy JSON -> naive outbound + users extractor
    mieru.js             # Mihomo/Mieru YAML -> mieru outbound + mihomo proxy + users extractor
  platformPipeline.js    # Единый эмиттер артефактов на платформы
  singBox.js             # template.sing-box.json + inbounds + sing-box:// subscription
  mihomo.js              # template.mihomo.yaml + rule-provider auth + clash:// subscription
  android.js             # Android sing-box: tun / hybrid / socks
  androidClash.js        # Android Clash + iOS mihomo: только TUN yaml
  mihomoProxies.js       # Сбор raw proxy yaml + all-proxies.yaml per server
  urlAuth.js             # Basic-auth: URL enrichment (sing-box/Throne) и header (mihomo)
  throne.js              # Throne subscriptions + чтение throne.*.txt с auth enrichment
  sourceProfile.js       # profileId из имени файла источника
  report.js              # централизованный warn/error/summary

defaultConfigs/
  template.sing-box.json
  template.mihomo.yaml
  throne.direct.txt
  throne.proxy.txt
  inbound.socks.sing-box.json
  inbound.tun.sing-box.json
  config.json.sample
  webSiteTemplate.twig
  ...
```

Удалены старые файлы: `utils/context.js`, `utils/vless.js`, `utils/awg.js`, `utils/naiveproxy.js`, `utils/protocolHandlers.js`, `utils/routingData.js`, монолитный `singBoxTemplate.json`.

## Runtime-пайплайн

1. `index.js:mainProcess()` сбрасывает `report` и `mihomoProxies`.
2. `files.getUserFiles(commonConfig)` сканирует `data/src`:
   - `per-user` берётся из `{server}/{user}/...`
   - `server-shared` (naiveproxy/mieru) разворачивается на всех пользователей, найденных парсером.
3. Для каждого пользователя сначала очищаются `common/windows/android/android-clash/ios/raw` директории.
4. Для каждого файла:
   - ищется handler в `protocolRegistry.findHandler(file.name)`;
   - строится `ctx.withProfile(handler.getProfileId(file.name))`;
   - вызывается `handler.generate(ctx, file)` → `platformPipeline.run(...)`.
5. После протоколов по каждому серверу/пользователю:
   - `mihomoProxies.flushAll()` пишет агрегированный `*-all-proxies.yaml` в `raw`;
   - добавляется `tg://socks` ссылка в `common/android`;
   - строятся `direct-rules.txt` и `proxy-rules.txt` в `common/windows` (из `throne.*.txt`, per-user auth);
   - рендерится `users/{user}/index.html`.
6. Копируются `site/*` и `docs/for-users.pdf`, `docs/for-admins.pdf`.
7. При включённом `rsync` выполняется синхронизация.
8. Печатается итоговый отчёт; при ошибках парсинга — `exit(1)`.

## Sing-box: сборка конфига (Android / hc-box)

Конфиг читается из `template.sing-box.json` (override: `configs/`), обогащается auth per-user, дополняется outbound/endpoint протокола и inbounds:

```
template.sing-box.json
+ urlAuth.enrichUrlsInValue(authForUser)   # credentials в URL
+ outbound/endpoint из парсера протокола
+ inbounds (tun/socks)
```

Android получает три варианта: `tun`, `hybrid` (TUN+SOCKS), `socks` + `sing-box://import-remote-profile` подписки.

### Basic-auth во внутренних URL (sing-box / Throne)

Если HTTP(S) URL имеет тот же origin, что `webServer.baseUrl`, при генерации для пользователя в URL встраивается basic-auth (`urlAuth.enrichUrlsInValue` / `enrichThroneLine`). В исходных конфигах URL хранятся **без** credentials.

## Mihomo / Clash: сборка конфига (android-clash / iOS)

Конфиг читается из `template.mihomo.yaml` (override: `configs/`):

```
template.mihomo.yaml
+ strip PROCESS-NAME / PROCESS-NAME-REGEX rules (только iOS)
+ enrichRuleProviders: header.Authorization для внутренних URL (URL не меняется)
+ proxy с name: proxy → proxies[]
+ proxy добавляется в группу PROXY
```

- **android-clash**: только TUN yaml + `clash://install-config?url=...&name=...`
- **iOS**: только TUN yaml; на сайте кнопки «Скачать» и «Копировать ссылку» (без copy-data и без clash:// deeplink)

Генерируется для протоколов с `mihomoEntity`: vless, awg, mieru. naiveproxy mihomo не поддерживает.

## Throne routing

`throne.extractWindowsRoutes(ctx)` читает `throne.direct.txt` / `throne.proxy.txt` (override: `configs/`), обогащает `ruleset:<url>` строки auth per-user и записывает в `direct-rules.txt` / `proxy-rules.txt`.

## GenerationContext

`GenerationContext` хранит:

- `user`, `server`, `protocol`, `platform`, `profileId`.

Переходы контекста делаются через copy-on-write:

- `withProfile()`, `withProtocol()`, `withPlatform()`, `forCommon()`.

Вспомогательные методы:

- `dir(platform?)`, `getWinDir()/getAndroidDir()/getAndroidClashDir()/getIosDir()/getRawDir()`,
- `displayProtocol()` (использует `profileId`, если задан),
- `serverDisplayName()` (через `config.getVpnServerConfig`).

## Протокольный слой

`protocolRegistry.handlers` описывает каждый протокол:

- `pattern` (какие файлы матчить),
- `layout` (`per-user` или `server-shared`),
- `extractUsers` (для `server-shared`),
- `getProfileId`,
- `generate` — парсинг + `plan()` + `platformPipeline.run()`.

`plan({ raw, android, androidClash, ios, iosMihomo, windows, telegram, mihomo, tunExclude })` строит матрицу платформ для `platformPipeline`.

Handlers:

- **vless** — sing-box outbound + mihomo proxy; android, android-clash, ios mihomo, windows Throne, raw.
- **awg** — sing-box endpoint + mihomo wireguard; android, android-clash, ios (.conf + mihomo), windows Throne AWG, raw.
- **naiveproxy** — sing-box outbound (naive-https / naive-quic); android, windows; mihomo нет.
- **mieru** — sing-box + mihomo mieru proxy; android, android-clash, ios mihomo, raw.
- **telegram** — deep link в common.

## Платформенный эмиттер

`platformPipeline` writers по платформам:

| Платформа | Форматы | Writer |
|-----------|---------|--------|
| `raw` | `singboxOutbound`, `singboxEndpoint`, `mihomoProxy` | JSON/yaml outbound, копии .conf, per-protocol proxy yaml |
| `android` | `singbox` | tun/hybrid/socks через `android.processAndroidConfig` |
| `android-clash` | `mihomo` | TUN yaml + clash:// через `androidClash.processAndroidClashConfig` |
| `ios` | `copyConf`, `mihomo` | AWG .conf и/или TUN yaml (без clash deeplink) |
| `windows` | `throneLink`, `awg` | `.link` + `subscriptions.txt` |
| `telegram` | `proxyLink` | deep link в common |

## Raw mihomo proxies

`mihomoProxies.collect()` накапливает proxy per server/user; `flushAll()` после обработки всех файлов сервера пишет `{server}-{user}-all-proxies.yaml` в `raw/`.

## Отчёт и контроль ошибок

`utils/report.js`:

- собирает `warn` и `error` по файлам/протоколам,
- считает `processed` и `skipped`,
- печатает итоговый summary,
- предоставляет `hasErrors()` для фатального завершения процесса.
