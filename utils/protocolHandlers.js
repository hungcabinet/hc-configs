import fs from 'fs';
import config from './config.js';
import report from './report.js';
import platformPipeline from './platformPipeline.js';
import vlessParser from './parsers/vless.js';
import awgParser from './parsers/awg.js';
import naiveproxyParser from './parsers/naiveproxy.js';
import mieruParser from './parsers/mieru.js';

function buildNaiveWindowsLink(ctx, endpoint, data, quic) {
    const linkUrl = new URL(`https://${endpoint}`);

    linkUrl.searchParams.set("uot", "1");
    if (quic) {
        linkUrl.searchParams.set("congestion_control", "bbr2");
    }
    linkUrl.searchParams.set("security", "tls");
    linkUrl.searchParams.set("sni", data.parsed.sni);

    linkUrl.username = data.parsed.username;
    linkUrl.password = data.parsed.password;
    linkUrl.hash = `${ctx.serverDisplayName()} [${ctx.protocol}]`;

    return linkUrl.href
        .replace("https://", quic ? "naive+quic://" : "naive+https://")
        .replace(`${endpoint}/?`, `${endpoint}:${data.parsed.port}?`)
}

function generateVless(ctx, file) {
    const protocolCtx = ctx.withProtocol('vless');
    const content = fs.readFileSync(file.path, 'utf-8');
    const data = vlessParser.toOutbound(content);

    report.logValidation('vless', file.path, data);

    if (!data.success) {
        report.recordSkipped();
        return;
    }

    report.recordProcessed();

    const serverName = protocolCtx.serverDisplayName();
    const throneLink = vlessParser.fixVlessLink(content, `${serverName} [${protocolCtx.displayProtocol()}]`, 'windows');

    platformPipeline.emitOutboundProtocol(protocolCtx, {
        tunExclude: [`${data.parsed.address}/32`],
        singbox: { type: 'outbound', value: data.outbound },
        windows: { link: throneLink }
    }, file, {
        rawExtras: [{
            content: vlessParser.fixVlessLink(content, serverName, 'windows'),
            extension: 'link',
            label: `[${protocolCtx.displayProtocol()}] ссылка для xray клиентов`,
            linkType: 'link',
            attributes: ['download', 'copy-data']
        }]
    });
}

function generateAwg(ctx, file) {
    const protocolCtx = ctx.withProtocol('awg');
    const data = awgParser.toEndpoint(fs.readFileSync(file.path, 'utf-8'));

    report.logValidation('awg', file.path, data);

    if (!data.success) {
        report.recordSkipped();
        return;
    }

    report.recordProcessed();

    platformPipeline.emitAwgProtocol(protocolCtx, {
        tunExclude: data.parsed.peers.map(value => `${value.endpointHost}/32`),
        singbox: { type: 'endpoint', value: data.endpoint },
        parsed: data.parsed
    }, file);
}

function generateNaiveproxy(ctx, file) {
    const naiveConfig = config.getVpnServerConfig(ctx.server).naiveproxy;
    const variants = [{ name: 'naive-https', quic: false }];

    if (naiveConfig.useQuic) {
        variants.push({ name: 'naive-quic', quic: true });
    }

    const configData = JSON.parse(fs.readFileSync(file.path, 'utf-8'));

    for (const variant of variants) {
        const protocolCtx = ctx.withProtocol(variant.name);
        const data = naiveproxyParser.toOutbound(configData, naiveConfig.ip, ctx.user, variant.quic);

        report.logValidation(variant.name, file.path, data);

        if (!data.success) {
            report.recordSkipped();
            continue;
        }

        report.recordProcessed();

        platformPipeline.emitOutboundProtocol(protocolCtx, {
            tunExclude: [`${naiveConfig.ip}/32`],
            singbox: { type: 'outbound', value: data.outbound },
            windows: { link: buildNaiveWindowsLink(protocolCtx, naiveConfig.ip, data, variant.quic) }
        }, file, {
            rawOutboundType: 'https-outbound'
        });
    }
}

function generateTelegram(ctx, file) {
    platformPipeline.emitTelegramProtocol(ctx, file);
    report.recordProcessed();
}

function generateMieru(ctx, file) {
    const protocolCtx = ctx.withProtocol('mieru');
    const configData = mieruParser.readConfig(file.path);
    const mieruConfig = config.getVpnServerConfig(ctx.server).mieru || {};
    const data = mieruParser.toOutbound(configData, mieruConfig.ip, ctx.user);

    report.logValidation('mieru', file.path, data);

    if (!data.success) {
        report.recordSkipped();
        return;
    }

    report.recordProcessed();

    platformPipeline.emitAndroidRawOutboundProtocol(protocolCtx, {
        tunExclude: data.parsed?.tunExclude || [],
        singbox: { type: 'outbound', value: data.outbound }
    }, file, {
        rawOutboundLabel: `[${protocolCtx.displayProtocol()}] outbound для кастомных конфигов hc-box или sing-box`
    });
}

export default {
    generateVless,
    generateAwg,
    generateNaiveproxy,
    generateTelegram,
    generateMieru
};