import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import files from './files.js';
import webSite from './webSite.js';
import { createContext } from './generationContext.js';

const collected = new Map();
const siteLinkAttributes = ['download', 'copy-data', 'copy-link'];

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

    collected.get(mapKey).push(proxy);
}

function flushAll(user, server) {
    const proxies = collected.get(key(user, server));

    if (!proxies?.length) {
        return;
    }

    const ctx = createContext(user, server).withPlatform('raw');
    const filePath = path.join(ctx.dir(), `${files.getFileName(ctx, 'all-proxies')}.yaml`);

    fs.writeFileSync(filePath, yaml.dump({ proxies }, { lineWidth: -1, noRefs: true }));

    webSite.addUserFileLink(
        ctx,
        filePath,
        'Все proxy для кастомных конфигов mihomo',
        'proxy',
        siteLinkAttributes
    );

    collected.delete(key(user, server));
}

export default { reset, namedProxy, collect, flushAll };
