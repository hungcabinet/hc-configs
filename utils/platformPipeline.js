import fs from 'fs';
import path from 'path';
import merge from 'deepmerge';
import files from './files.js';
import singBox from './singBox.js';
import android from './android.js';
import androidClash from './androidClash.js';
import throne from './throne.js';
import webSite from './webSite.js';
import mihomoProxies from './mihomoProxies.js';
import mihomo from './mihomo.js';

// --- Writers: платформа → запись файлов и ссылок на сайте ---

function writeRawSingboxOutbound(ctx, payload, file, options) {
    const rawCtx = ctx.withPlatform('raw');
    const rawDir = rawCtx.dir();
    const outboundType = options.fileSuffix || 'outbound';

    const outboundFilePath = files.saveJsonObject(rawCtx, payload.singbox.value, rawDir, outboundType);
    webSite.addUserFileLink(
        rawCtx,
        outboundFilePath,
        options.label || `[${ctx.displayProtocol()}] outbound для кастомных конфигов hc-box или sing-box`,
        'outbound',
        ['download', 'copy-data']
    );

    for (const extra of options.extras || []) {
        const filePath = path.join(rawDir, extra.fileName || `${files.getFileName(rawCtx)}.${extra.extension}`);

        if (extra.copyFrom) {
            fs.copyFileSync(extra.copyFrom, filePath);
        } else {
            fs.writeFileSync(filePath, extra.content);
        }

        webSite.addUserFileLink(rawCtx, filePath, extra.label, extra.linkType || 'link', extra.attributes || ['download', 'copy-data']);
    }
}

function writeRawSingboxEndpoint(ctx, payload, file) {
    const rawCtx = ctx.withPlatform('raw');
    const rawDir = rawCtx.dir();

    const outboundFilePath = files.saveJsonObject(rawCtx, payload.singbox.value, rawDir, 'outbound');
    webSite.addUserFileLink(
        rawCtx,
        outboundFilePath,
        `[${ctx.displayProtocol()}] endpoint для кастомных конфигов hc-box`,
        'outbound',
        ['download', 'copy-data']
    );

    const confPath = path.join(rawDir, `${files.getFileName(rawCtx)}.conf`);
    fs.copyFileSync(file.path, confPath);
    webSite.addUserFileLink(
        rawCtx,
        confPath,
        `[${ctx.displayProtocol()}] конфиг для AmneziaVPN или AmneziaWG`,
        'config',
        ['download', 'copy-data']
    );
}

function writeRawMihomoProxy(ctx, payload, file, options) {
    if (!payload.mihomo?.value) {
        return;
    }

    const rawCtx = ctx.withPlatform('raw');
    const rawDir = rawCtx.dir();
    const fileSuffix = options.fileSuffix || 'proxy';
    const proxy = mihomoProxies.namedProxy(rawCtx, payload.mihomo.value);
    const filePath = files.saveYamlObject(
        rawCtx,
        { proxies: [proxy] },
        rawDir,
        fileSuffix
    );

    mihomoProxies.collect(rawCtx, proxy);

    webSite.addUserFileLink(
        rawCtx,
        filePath,
        options.label || `[${ctx.displayProtocol()}] proxy для кастомных конфигов mihomo`,
        'proxy',
        ['download', 'copy-data', 'copy-link']
    );
}

function writeAndroidClashMihomo(ctx, payload) {
    if (!payload.mihomo?.value) {
        return;
    }

    const template = mihomo.getTemplate(ctx);
    const clientConfig = mihomo.buildClientConfig(template, payload.mihomo.value);

    androidClash.processAndroidClashConfig(ctx, clientConfig);
}

function writeIosMihomo(ctx, payload) {
    if (!payload.mihomo?.value) {
        return;
    }

    const iosCtx = ctx.withPlatform('ios');
    const template = mihomo.getTemplate(iosCtx, { forIos: true });
    const clientConfig = mihomo.buildClientConfig(template, payload.mihomo.value);

    androidClash.processIosMihomoConfig(ctx, clientConfig);
}

function writeAndroidSingbox(ctx, payload, file, options, inbounds) {
    const androidCtx = ctx.withPlatform('android');
    const androidConfig = singBox.getAndroidTemplate(ctx);

    if (payload.singbox.type === 'outbound') {
        androidConfig.outbounds.push(merge({}, payload.singbox.value));
    } else {
        androidConfig.endpoints.push(payload.singbox.value);
    }

    android.processAndroidConfig(androidCtx, androidConfig, inbounds.tun, inbounds.socks);
}

function writeIosCopyConf(ctx, payload, file, options) {
    const iosCtx = ctx.withPlatform('ios');
    const suffix = options.suffix ?? '';
    const filePath = path.join(iosCtx.dir(), `${files.getFileName(iosCtx, suffix)}.conf`);

    fs.copyFileSync(file.path, filePath);
    webSite.addUserFileLink(
        iosCtx,
        filePath,
        `[${ctx.displayProtocol()}] конфиг для AmneziaVPN или AmneziaWG`,
        'config',
        ['download', 'copy-data']
    );
}

function writeWindowsThroneLink(ctx, payload, file, options) {
    const winCtx = ctx.withPlatform('windows');
    const linkFilePath = path.join(winCtx.dir(), options.linkFileName || `${files.getFileName(winCtx)}.link`);

    fs.writeFileSync(linkFilePath, options.link);
    webSite.addUserFileLink(
        winCtx,
        linkFilePath,
        options.linkLabel || `[${ctx.displayProtocol()}] ссылка для Throne`,
        'link',
        ['download', 'copy-data']
    );

    const commonWinDir = ctx.forCommon().withPlatform('windows').dir();
    const subscriptionFilePath = throne.addLinkToSubscription(commonWinDir, options.link);
    const commonWinCtx = ctx.forCommon().withPlatform('windows');

    webSite.addUserFileLink(
        commonWinCtx,
        subscriptionFilePath,
        'Подписка для Throne',
        'subscription',
        ['copy-link']
    );
}

function writeWindowsAwg(ctx, payload, file) {
    const winCtx = ctx.withPlatform('windows');
    const awgLinkFile = path.join(winCtx.dir(), `${files.getFileName(winCtx, 'awg')}.link`);
    const commonWinDir = ctx.forCommon().withPlatform('windows').dir();
    const linkData = throne.addAmneziaSubscription(commonWinDir, payload.parsed, ctx);

    fs.writeFileSync(awgLinkFile, linkData.link);
    webSite.addUserFileLink(
        winCtx,
        awgLinkFile,
        `[${ctx.displayProtocol()}] ссылка для Throne`,
        'link',
        ['download', 'copy-data']
    );

    webSite.addUserFileLink(
        ctx.forCommon().withPlatform('windows'),
        linkData.filePath,
        'Подписка для Throne',
        'subscription',
        ['copy-link']
    );
}

function writeTelegramProxyLink(ctx, payload, file) {
    const link = fs.readFileSync(file.path, 'utf-8');
    const telegramCtx = ctx.withProtocol('telegram').withPlatform('telegram');
    const linkFilePath = path.join(telegramCtx.getCommonDir(), `${files.getFileName(telegramCtx)}.link`);

    fs.copyFileSync(file.path, linkFilePath);
    webSite.addSpecificLink(
        telegramCtx,
        link,
        `[${telegramCtx.displayProtocol()}] Telegram proxy`,
        'telegram'
    );
}

const writers = {
    raw: {
        singboxOutbound: writeRawSingboxOutbound,
        singboxEndpoint: writeRawSingboxEndpoint,
        mihomoProxy: writeRawMihomoProxy,
    },
    android: { singbox: writeAndroidSingbox },
    'android-clash': { mihomo: writeAndroidClashMihomo },
    ios: { copyConf: writeIosCopyConf, mihomo: writeIosMihomo },
    windows: { throneLink: writeWindowsThroneLink, awg: writeWindowsAwg },
    telegram: { proxyLink: writeTelegramProxyLink },
};

// --- Runner: plan.platforms → writers ---

function normalizeFormatOptions(options) {
    if (options === true || options === undefined) {
        return {};
    }

    return options;
}

function run(ctx, payload, file, plan) {
    const tunExclude = plan.tunExclude ?? payload.tunExclude ?? [];
    const needsInbounds = Object.values(plan.platforms || {}).some(formats =>
        formats.singbox !== undefined
    );

    const inbounds = needsInbounds
        ? {
            tun: singBox.getTunInbound(tunExclude),
            socks: singBox.getSocksInbound(),
        }
        : undefined;

    const mergedPayload = { ...payload, tunExclude };

    for (const [platform, formats] of Object.entries(plan.platforms || {})) {
        for (const [format, formatOptions] of Object.entries(formats)) {
            const writer = writers[platform]?.[format];

            if (writer) {
                writer(ctx, mergedPayload, file, normalizeFormatOptions(formatOptions), inbounds);
            }
        }
    }
}

export default { run };
