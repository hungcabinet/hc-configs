import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import files from './files.js';
import webSite from './webSite.js';
import mihomo from './mihomo.js';
import androidClash from './androidClash.js';
import { createContext } from './generationContext.js';

const collected = new Map();
const siteLinkAttributes = ['download', 'copy-data', 'copy-link'];
const PROTOCOL_ORDER = ['vless', 'awg', 'mieru'];

function key(user, server) {
    return `${user}\0${server}`;
}

function getProxyName(ctx) {
    return files.getFileName(ctx, ctx.protocol);
}

function namedProxy(ctx, mihomoValue) {
    return { ...mihomoValue, name: getProxyName(ctx) };
}

function reset() {
    collected.clear();
}

function collect(ctx, proxy) {
    const mapKey = key(ctx.user, ctx.server);

    if (!collected.has(mapKey)) {
        collected.set(mapKey, []);
    }

    collected.get(mapKey).push({
        protocol: ctx.protocol,
        proxy,
    });
}

function protocolRank(protocol) {
    const index = PROTOCOL_ORDER.indexOf(protocol);

    return index === -1 ? PROTOCOL_ORDER.length : index;
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        const rankDiff = protocolRank(a.protocol) - protocolRank(b.protocol);

        if (rankDiff !== 0) {
            return rankDiff;
        }

        return String(a.proxy.name).localeCompare(String(b.proxy.name), 'en');
    });
}

function flushRawAllProxies(ctx, proxies) {
    const filePath = path.join(ctx.dir(), `${files.getFileName(ctx, 'all-proxies')}.yaml`);

    fs.writeFileSync(filePath, yaml.dump({ proxies }, { lineWidth: -1, noRefs: true }));

    webSite.addUserFileLink(
        ctx,
        filePath,
        'Все proxy для кастомных конфигов mihomo',
        'proxy',
        siteLinkAttributes
    );
}

function flushClashAllProxies(ctx, proxies) {
    const androidClashConfig = mihomo.buildMultiProxyClientConfig(
        mihomo.getTemplate(ctx.withPlatform('android-clash')),
        proxies
    );
    const windowsClashConfig = mihomo.buildMultiProxyClientConfig(
        mihomo.getTemplate(ctx.withPlatform('windows-clash'), { withoutAndroidApps: true }),
        proxies
    );
    const iosConfig = mihomo.buildMultiProxyClientConfig(
        mihomo.getTemplate(ctx.withPlatform('ios'), { withoutAndroidApps: true }),
        proxies
    );

    androidClash.processAllProxiesClashConfigs(ctx, {
        'android-clash': androidClashConfig,
        'windows-clash': windowsClashConfig,
        ios: iosConfig,
    });
}

function flushAll(user, server) {
    const entries = collected.get(key(user, server));

    if (!entries?.length) {
        return;
    }

    const proxies = sortEntries(entries).map((entry) => entry.proxy);
    const ctx = createContext(user, server);

    flushRawAllProxies(ctx.withPlatform('raw'), proxies);
    flushClashAllProxies(ctx, proxies);

    collected.delete(key(user, server));
}

export default { reset, namedProxy, collect, flushAll };
