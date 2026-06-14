import fs from 'fs';
import path from 'path';
import merge from 'deepmerge';
import files from './files.js';
import singBox from './singBox.js';
import android from './android.js';
import throne from './throne.js';
import webSite from './webSite.js';

function emitRawOutbound(ctx, parsed, options) {
    const rawCtx = ctx.withPlatform('raw');
    const rawDir = rawCtx.dir();
    const outboundType = options.rawOutboundType || 'outbound';

    const outboundFilePath = files.saveJsonObject(rawCtx, parsed.singbox.value, rawDir, outboundType);
    webSite.addUserFileLink(
        rawCtx,
        outboundFilePath,
        options.rawOutboundLabel || `[${ctx.displayProtocol()}] outbound для кастомных конфигов hc-box или sing-box`,
        'outbound',
        ['download', 'copy-data']
    );

    for (const extra of options.rawExtras || []) {
        const filePath = path.join(rawDir, extra.fileName || `${files.getFileName(rawCtx)}.${extra.extension}`);

        if (extra.copyFrom) {
            fs.copyFileSync(extra.copyFrom, filePath);
        } else {
            fs.writeFileSync(filePath, extra.content);
        }

        webSite.addUserFileLink(rawCtx, filePath, extra.label, extra.linkType || 'link', extra.attributes || ['download', 'copy-data']);
    }
}

function emitAndroidOutbound(ctx, parsed, tunInbound, socksInbound) {
    const androidCtx = ctx.withPlatform('android');
    const androidConfig = singBox.getAndroidTemplate();

    if (parsed.singbox.type === 'outbound') {
        androidConfig.outbounds.push(merge({}, parsed.singbox.value));
    } else {
        androidConfig.endpoints.push(parsed.singbox.value);
    }

    android.processAndroidConfig(androidCtx, androidConfig, tunInbound, socksInbound);
}

function emitIosSingboxOutbound(ctx, parsed, tunInbound) {
    const iosCtx = ctx.withPlatform('ios');
    const iosConfig = singBox.getIosTemplate();
    const outbound = merge({}, parsed.singbox.value);

    if (outbound?.tls?.utls?.fingerprint !== undefined) {
        outbound.tls.utls.fingerprint = 'safari';
    }

    iosConfig.outbounds.push(outbound);
    iosConfig.inbounds.push(tunInbound);

    const filePath = files.saveJsonObject(iosCtx, iosConfig, iosCtx.dir(), 'tun');
    const link = webSite.addUserFileLink(
        iosCtx,
        filePath,
        `[${ctx.displayProtocol()}] конфиг для sing-box`,
        'config',
        ['download', 'copy-data']
    );
    webSite.addSpecificLink(
        iosCtx,
        link,
        `[${ctx.displayProtocol()}] подписка для sing-box`,
        'subscription',
        ['copy-link']
    );
}

function emitIosCopyConf(ctx, file, fileNameSuffix) {
    const iosCtx = ctx.withPlatform('ios');
    const filePath = path.join(iosCtx.dir(), `${files.getFileName(iosCtx, fileNameSuffix)}.conf`);

    fs.copyFileSync(file.path, filePath);
    webSite.addUserFileLink(
        iosCtx,
        filePath,
        `[${ctx.displayProtocol()}] конфиг для AmneziaVPN или AmneziaWG`,
        'config',
        ['download', 'copy-data']
    );
}

function emitWindowsThroneLink(ctx, windowsData) {
    const winCtx = ctx.withPlatform('windows');
    const linkFilePath = path.join(winCtx.dir(), windowsData.linkFileName || `${files.getFileName(winCtx)}.link`);

    fs.writeFileSync(linkFilePath, windowsData.link);
    webSite.addUserFileLink(
        winCtx,
        linkFilePath,
        windowsData.linkLabel || `[${ctx.displayProtocol()}] ссылка для Throne`,
        'link',
        ['download', 'copy-data']
    );

    const commonWinDir = ctx.forCommon().withPlatform('windows').dir();
    const subscriptionFilePath = throne.addLinkToSubscription(commonWinDir, windowsData.link);
    const commonWinCtx = ctx.forCommon().withPlatform('windows');

    webSite.addUserFileLink(
        commonWinCtx,
        subscriptionFilePath,
        'Подписка для Throne',
        'subscription',
        ['copy-link']
    );
}

function emitWindowsAwg(ctx, file, parsed) {
    const winCtx = ctx.withPlatform('windows');
    const awgLinkFile = path.join(winCtx.dir(), `${files.getFileName(winCtx, 'awg')}.link`);
    const commonWinDir = ctx.forCommon().withPlatform('windows').dir();
    const linkData = throne.addAmneziaSubscription(commonWinDir, parsed.parsed, ctx);

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

function emitRawAwg(ctx, parsed, file) {
    const rawCtx = ctx.withPlatform('raw');
    const rawDir = rawCtx.dir();

    const outboundFilePath = files.saveJsonObject(rawCtx, parsed.singbox.value, rawDir, 'outbound');
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

function emitOutboundProtocol(ctx, parsed, file, options = {}) {
    const tunInbound = singBox.getTunInbound(parsed.tunExclude);
    const socksInbound = singBox.getSocksInbound();

    emitRawOutbound(ctx, parsed, options);
    emitAndroidOutbound(ctx, parsed, tunInbound, socksInbound);
    emitIosSingboxOutbound(ctx, parsed, tunInbound);

    if (parsed.windows) {
        emitWindowsThroneLink(ctx, parsed.windows);
    }
}

function emitAndroidRawOutboundProtocol(ctx, parsed, file, options = {}) {
    const tunInbound = singBox.getTunInbound(parsed.tunExclude || []);
    const socksInbound = singBox.getSocksInbound();

    emitRawOutbound(ctx, parsed, options);
    emitAndroidOutbound(ctx, parsed, tunInbound, socksInbound);
}

function emitAwgProtocol(ctx, parsed, file) {
    const tunInbound = singBox.getTunInbound(parsed.tunExclude);
    const socksInbound = singBox.getSocksInbound();

    emitRawAwg(ctx, parsed, file);
    emitAndroidOutbound(ctx, parsed, tunInbound, socksInbound);
    emitIosCopyConf(ctx, file, 'awg');
    emitWindowsAwg(ctx, file, parsed);
}

function emitTelegramProtocol(ctx, file) {
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

export default {
    emitOutboundProtocol,
    emitAndroidRawOutboundProtocol,
    emitAwgProtocol,
    emitTelegramProtocol
};
