# Memory Bank — hc-configs

Актуальный банк памяти по проекту `hc-configs` (генератор персональных VPN-конфигов).

## Файлы

- `projectbrief.md` — назначение проекта, вход/выход, протоколы и платформы.
- `architecture.md` — текущая модульная архитектура и runtime-пайплайн.
- `conventions.md` — формат входных/выходных данных, naming, правила расширения.

## Быстрый старт

1. Скопировать `defaultConfigs/config.json.sample` в `configs/config.json`.
2. Подготовить входные файлы в `data/src/{server}/{user}/` (и `naiveproxy*.json` на уровне сервера при необходимости).
3. Запустить `node index.js`.
4. Проверить результат в `data/dst/` и отчёт в stdout (`=== Отчёт генерации ===`).

Примечание по `mieru`: серверный endpoint задаётся в `configs/config.json` через `vpnServers.default.mieru.ip` (или `vpnServers.servers.{server}.mieru.ip` для переопределения).  
Если `mieru.ip` не задан, парсер использует `listeners[].listen` из `mihomo/mieru` yaml.

## Ключевые точки входа

- Оркестрация: `index.js`
- Контекст генерации: `utils/generationContext.js`
- Реестр протоколов: `utils/protocolRegistry.js`
- Обработчики протоколов: `utils/protocolHandlers.js`
- Парсеры: `utils/parsers/*.js`
- Платформенный вывод: `utils/platformPipeline.js`
- sing-box шаблон и inbounds: `utils/singBox.js`
- Маршрутизация sing-box / Throne rules: `utils/routingData.js`
- Basic-auth во внутренних URL: `utils/urlAuth.js`
- Веб-портал: `utils/webSite.js`
- Отчётность/валидация: `utils/report.js`

## Override конфигов sing-box

Файлы из `defaultConfigs/` можно переопределить через `configs/` (тот же относительный путь):

- `routing.sing-box.json` — списки маршрутизации, DNS, приложения
- `template.sing-box.json` — базовый каркас sing-box (log, outbounds, route.final)
- `inbound.socks.sing-box.json`, `inbound.tun.sing-box.json` — inbounds

Подробности формата — в `conventions.md` и `readme.md`.
