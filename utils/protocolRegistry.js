import fs from 'fs';
import config from './config.js';
import report from './report.js';
import platformPipeline from './platformPipeline.js';
import sourceProfile from './sourceProfile.js';
import vlessParser from './parsers/vless.js';
import awgParser from './parsers/awg.js';
import naiveproxyParser from './parsers/naiveproxy.js';
import mieruParser from './parsers/mieru.js';

// --- Матрица вывода: plan({ raw, android, ios, windows, telegram, mihomo, tunExclude }) ---

function withMihomoRaw(rawFormats, mihomo) {
    if (!mihomo?.value) {
        return rawFormats;
    }

    return { ...rawFormats, mihomoProxy: true };
}

function plan({ tunExclude, mihomo, raw, android, androidClash, ios, iosMihomo, windows, telegram }) {
    const platforms = {};

    if (raw?.outbound !== undefined) {
        platforms.raw = withMihomoRaw({ singboxOutbound: raw.outbound ?? {} }, mihomo);
    } else if (raw?.endpoint) {
        platforms.raw = withMihomoRaw({ singboxEndpoint: true }, mihomo);
    }

    if (android) {
        platforms.android = { singbox: true };
    }

    if (androidClash && mihomo?.value) {
        platforms['android-clash'] = { mihomo: true };
    }

    const iosFormats = ios === true ? {} : (ios || {});

    if (iosMihomo && mihomo?.value) {
        iosFormats.mihomo = true;
    }

    if (Object.keys(iosFormats).length > 0) {
        platforms.ios = iosFormats;
    }

    if (windows?.throneLink) {
        platforms.windows = { throneLink: windows.throneLink };
    } else if (windows?.awg) {
        platforms.windows = { awg: true };
    }

    if (telegram) {
        platforms.telegram = { proxyLink: true };
    }

    return { tunExclude, platforms };
}

// --- Общие helpers ---

function mihomo(data) {
    return data.mihomoEntity ? { value: data.mihomoEntity } : undefined;
}

function acceptSingbox(scope, file, data) {
    report.logValidation(scope, file.path, data);

    if (!data.success || !data.singBoxEntity) {
        report.recordSkipped();
        return false;
    }

    report.recordProcessed();
    return true;
}

function buildNaiveWindowsLink(ctx, endpoint, data, quic) {
    const linkUrl = new URL(`https://${endpoint}`);

    linkUrl.searchParams.set('uot', '1');
    if (quic) {
        linkUrl.searchParams.set('congestion_control', 'bbr2');
    }
    linkUrl.searchParams.set('security', 'tls');
    linkUrl.searchParams.set('sni', data.parsed.sni);

    linkUrl.username = data.parsed.username;
    linkUrl.password = data.parsed.password;
    linkUrl.hash = `${ctx.serverDisplayName()} [${ctx.protocol}]`;

    return linkUrl.href
        .replace('https://', quic ? 'naive+quic://' : 'naive+https://')
        .replace(`${endpoint}/?`, `${endpoint}:${data.parsed.port}?`);
}

function handlerMeta(name, parser) {
    return {
        name,
        pattern: parser.source.pattern,
        layout: parser.source.layout,
        extractUsers: parser.source.getUsers,
        getProfileId: (fileName) => sourceProfile.getProfileId(fileName, name),
    };
}

// --- Handlers ---

const handlers = [
    {
        ...handlerMeta('vless', vlessParser),
        generate(ctx, file) {
            const protocolCtx = ctx.withProtocol('vless');
            const content = fs.readFileSync(file.path, 'utf-8');
            const data = vlessParser.parseData(content);

            if (!acceptSingbox('vless', file, data)) {
                return;
            }

            const serverName = protocolCtx.serverDisplayName();
            const mihomoData = mihomo(data);

            platformPipeline.run(protocolCtx, {
                singbox: { type: 'outbound', value: data.singBoxEntity },
                mihomo: mihomoData,
            }, file, plan({
                tunExclude: [`${data.parsed.address}/32`],
                mihomo: mihomoData,
                raw: {
                    outbound: {
                        extras: [{
                            content: vlessParser.fixVlessLink(content, serverName, 'windows'),
                            extension: 'link',
                            label: `[${protocolCtx.displayProtocol()}] ссылка для xray клиентов`,
                            linkType: 'link',
                            attributes: ['download', 'copy-data'],
                        }],
                    },
                },
                android: true,
                androidClash: true,
                iosMihomo: true,
                windows: {
                    throneLink: {
                        link: vlessParser.fixVlessLink(content, `${serverName} [${protocolCtx.displayProtocol()}]`, 'windows'),
                    },
                },
            }));
        },
    },

    {
        ...handlerMeta('awg', awgParser),
        generate(ctx, file) {
            const protocolCtx = ctx.withProtocol('awg');
            const data = awgParser.parseData(fs.readFileSync(file.path, 'utf-8'));

            if (!acceptSingbox('awg', file, data)) {
                return;
            }

            const mihomoData = mihomo(data);

            platformPipeline.run(protocolCtx, {
                singbox: { type: 'endpoint', value: data.singBoxEntity },
                parsed: data.parsed,
                mihomo: mihomoData,
            }, file, plan({
                tunExclude: data.parsed.peers.map(value => `${value.endpointHost}/32`),
                mihomo: mihomoData,
                raw: { endpoint: true },
                android: true,
                androidClash: true,
                ios: { copyConf: { suffix: 'awg' } },
                iosMihomo: true,
                windows: { awg: true },
            }));
        },
    },

    {
        ...handlerMeta('naiveproxy', naiveproxyParser),
        generate(ctx, file) {
            const naiveConfig = config.getVpnServerConfig(ctx.server).naiveproxy;
            const variants = [{ name: 'naive-https', quic: false }];

            if (naiveConfig.useQuic) {
                variants.push({ name: 'naive-quic', quic: true });
            }

            const configData = JSON.parse(fs.readFileSync(file.path, 'utf-8'));

            for (const variant of variants) {
                const protocolCtx = ctx.withProtocol(variant.name);
                const data = naiveproxyParser.parseData(configData, naiveConfig.ip, ctx.user, variant.quic);

                if (!acceptSingbox(variant.name, file, data)) {
                    continue;
                }

                platformPipeline.run(protocolCtx, {
                    singbox: { type: 'outbound', value: data.singBoxEntity },
                }, file, plan({
                    tunExclude: [`${naiveConfig.ip}/32`],
                    raw: { outbound: { fileSuffix: 'https-outbound' } },
                    android: true,
                    windows: {
                        throneLink: {
                            link: buildNaiveWindowsLink(protocolCtx, naiveConfig.ip, data, variant.quic),
                        },
                    },
                }));
            }
        },
    },

    {
        ...handlerMeta('mieru', mieruParser),
        generate(ctx, file) {
            const protocolCtx = ctx.withProtocol('mieru');
            const configData = mieruParser.readConfig(file.path);
            const mieruConfig = config.getVpnServerConfig(ctx.server).mieru || {};
            const data = mieruParser.parseData(configData, mieruConfig.ip, ctx.user);

            if (!acceptSingbox('mieru', file, data)) {
                return;
            }

            const mihomoData = mihomo(data);

            platformPipeline.run(protocolCtx, {
                singbox: { type: 'outbound', value: data.singBoxEntity },
                mihomo: mihomoData,
            }, file, plan({
                tunExclude: data.parsed?.tunExclude || [],
                mihomo: mihomoData,
                raw: {
                    outbound: {
                        label: `[${protocolCtx.displayProtocol()}] outbound для кастомных конфигов hc-box или sing-box`,
                    },
                },
                android: true,
                androidClash: true,
                iosMihomo: true,
            }));
        },
    },

    {
        name: 'telegram',
        pattern: /^telegram.*\.link$/i,
        layout: 'per-user',
        getProfileId: (fileName) => sourceProfile.getProfileId(fileName, 'telegram'),
        generate(ctx, file) {
            platformPipeline.run(ctx, {}, file, plan({ telegram: true }));
            report.recordProcessed();
        },
    },
];

function findHandler(fileName) {
    return handlers.find(handler => handler.pattern.test(fileName));
}

export default { handlers, findHandler };
