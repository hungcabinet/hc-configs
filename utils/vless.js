import {URL} from 'url';
import fs from "fs";
import files from "./files.js";
import singBox from "./singBox.js";
import path from "path";
import contextUtil from "./context.js";
import webSite from "./webSite.js";
import merge from "deepmerge";
import throne from "./throne.js";
import android from "./android.js";
import config from "./config.js";

function toOutbound(vlessLink, defaultFingerPrint = "chrome", tag = 'proxy', domainResolver = 'google'){
    const warnings = [];
    const errors = [];

    try {
        // Парсинг ссылки
        let url;
        try {
            // Заменяем протокол для корректного парсинга
            let link = vlessLink.replace('vless://', 'https://');
            url = new URL(link);
        } catch (e) {
            errors.push('Неверный формат VLESS ссылки');
            return { success: false, errors, warnings };
        }

        // Извлечение основных параметров
        let uuid = url.username;
        let address = url.hostname;
        let port = parseInt(url.port) || 443;

        // Если UUID в path (старый формат uuid@server:port)
        if (!uuid && url.pathname.includes('@')) {
            const parts = url.pathname.slice(1).split('@');
            uuid = parts[0];
            if (parts[1]) {
                const [addr, p] = parts[1].split(':');
                if (addr) address = addr;
                if (p) port = parseInt(p);
            }
        }

        const params = url.searchParams;
        const remarks = decodeURIComponent(url.hash.slice(1)) || 'VLESS Reality';

        const security = params.get('security') || 'none';
        const type = params.get('type') || 'tcp';
        const flow = params.get('flow') || '';
        let fp = params.get('fp') || 'chrome';          // fingerprint
        const sni = params.get('sni') || params.get('servername') || '';
        const pbk = params.get('pbk') || '';               // public_key для Reality
        const sid = params.get('sid') || '';               // short_id
        const path = params.get('path') || '';
        const host = params.get('host') || '';

        // === Валидация поддерживаемых sing-box технологий ===

        if (security !== 'reality' && security !== 'tls' && security !== 'none') {
            warnings.push(`security=${security} — sing-box лучше всего работает с reality или tls`);
        }

        // Flow
        if (flow && flow !== 'xtls-rprx-vision') {
            errors.push(`flow=${flow} не поддерживается в sing-box. Поддерживается только "xtls-rprx-vision" или пустое значение.`);
        }

        // Transport (network)
        if (type !== 'tcp' && type !== 'ws' && type !== 'grpc' && type !== 'http') {
            warnings.push(`type=${type} — sing-box поддерживает tcp, ws, grpc, но Reality лучше всего работает с tcp`);
        }

        // Reality
        const isReality = security === 'reality';
        if (isReality && !pbk) {
            errors.push('Reality включён, но отсутствует параметр pbk (public_key)');
        }

        // Fingerprint
        const validFingerprints = ['chrome', 'firefox', 'edge', 'safari'];
        if (!validFingerprints.includes(fp)) {
            fp = defaultFingerPrint || "chrome";
        }

        // Сборка outbound
        const outbound = {
            type: "vless",
            tag: tag,
            server: address,
            server_port: port,
            uuid: uuid,
            flow: flow || undefined,                    // только xtls-rprx-vision или undefined
            packet_encoding: "xudp",                    // рекомендуется для Vision
            network: type === 'tcp' ? undefined : type, // по умолчанию tcp
        };

        // TLS блок
        const tls = {
            enabled: true,
            server_name: sni || (isReality ? 'www.microsoft.com' : address), // fallback SNI
            utls: {
                enabled: true,
                fingerprint: fp
            }
        };

        if (isReality) {
            tls.reality = {
                enabled: true,
                public_key: pbk,
                short_id: sid || undefined
            };
        }

        outbound.tls = tls;

        if (domainResolver) {
            outbound.domain_resolver = domainResolver;
        }

        // Дополнительные предупреждения
        if (isReality && flow !== 'xtls-rprx-vision') {
            warnings.push('Reality рекомендуется использовать вместе с flow=xtls-rprx-vision');
        }

        if (type !== 'tcp' && isReality) {
            warnings.push('Reality + WebSocket/gRPC может работать нестабильно в sing-box. Лучше использовать tcp.');
        }

        return {
            success: errors.length === 0,
            outbound,
            warnings,
            errors,
            parsed: {
                uuid, address, port, security, type, flow, fp, sni, pbk, sid, remarks
            }
        };

    } catch (err) {
        errors.push(`Неизвестная ошибка: ${err.message}`);
        return { success: false, errors, warnings };
    }
}

function generateUserData(userFileData){
    contextUtil.withProtocol("vless", () =>
    {
        let vlessLink = fs.readFileSync(userFileData.path, "utf-8");

        let data = toOutbound(vlessLink, "chrome");

        for (let j = 0; j < data.warnings.length; j++) {
            console.warn(`[WARN]: Android VLESS ${userFileData.path} - ${data.warnings[j]}`);
        }

        for (let j = 0; j < data.errors.length; j++) {
            console.error(`[ERR]: Android VLESS ${userFileData.path} - ${data.errors[j]}`);
        }

        if (!data.success){
            return;
        }

        let endpointHost = `${data.parsed.address}/32`;
        let tunInbound = singBox.getTunInbound([endpointHost]);

        contextUtil.withPlatform("raw", () => {
            let server = contextUtil.getServer();
            let serverName = config.getVpnServerConfig(server).name || server;

            let rawDir = contextUtil.getRawDir();

            let outboundFilePath = files.saveJsonObject(data.outbound, rawDir, "outbound");
            webSite.addUserFileLink(outboundFilePath, `[${contextUtil.getProtocol()}] outbound для кастомных конфигов hc-box или sing-box`, "outbound", ["download", "copy-data"]);

            let linkFilePath = path.join(rawDir, `${files.getFileName()}.link`);
            let fixedVlessLink = fixVlessLink(vlessLink, serverName);
            fs.writeFileSync(linkFilePath, fixedVlessLink);
            webSite.addUserFileLink(linkFilePath, `[${contextUtil.getProtocol()}] ссылка для xray клиентов`, "link", ["download", "copy-data"]);
        });


        contextUtil.withPlatform("android", () => {
            let socksInbound = singBox.getSocksInbound();

            let androidConfig = singBox.getAndroidTemplate();

            let outbound = merge({}, data.outbound);

            androidConfig.outbounds.push(outbound);

            android.processAndroidConfig(androidConfig, tunInbound, socksInbound);
        });

        contextUtil.withPlatform("ios", () => {
            let iosConfig = singBox.getIosTemplate();

            let outbound = merge({}, data.outbound);

            if (outbound?.tls?.utls?.fingerprint !== undefined){
                outbound.tls.utls.fingerprint = "safari"
            }

            iosConfig.outbounds.push(outbound);
            iosConfig.inbounds.push(tunInbound);
            let filePath = files.saveJsonObject(iosConfig, contextUtil.getIosDir(), "tun");
            let link = webSite.addUserFileLink(filePath, `[${contextUtil.getProtocol()}] конфиг для sing-box`, "config", ["download", "copy-data"]);
            webSite.addSpecificLink(singBox.getSubscriptionLink(link, "tun"), `[${contextUtil.getProtocol()}] подписка для sing-box`, "subscription");
        });

        contextUtil.withPlatform("windows", () => {
            let winDir = contextUtil.getWinDir();

            let server = contextUtil.getServer();
            let serverName = config.getVpnServerConfig(server).name || server;

            let fixedVlessLink = fixVlessLink(vlessLink, serverName);

            let linkFilePath = path.join(winDir, `${files.getFileName()}.link`);
            fs.writeFileSync(linkFilePath, fixedVlessLink);
            webSite.addUserFileLink(linkFilePath, `[${contextUtil.getProtocol()}] ссылка для Throne`, "link", ["download", "copy-data"]);

            contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                winDir = contextUtil.getWinDir();
            });

            let subscriptionFilePath = throne.addLinkToSubscription(winDir, fixedVlessLink);

            contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                webSite.addUserFileLink(subscriptionFilePath, `Подписка для Throne`, "subscription", ["copy-link"]);
            });
        });
    });
}

function fixVlessLink(vlessLink, customName = undefined){
    let link = vlessLink.replace('vless://', 'https://');
    let url = new URL(link);

    const params = url.searchParams;

    let fp = params.get('fp') || 'chrome';

    if (contextUtil.getPlatform() === "ios"){
        params.set('fp', "safari");
    }
    else{
        const validFingerprints = ['chrome', 'firefox', 'edge', 'safari'];

        if (!validFingerprints.includes(fp)) {
            fp = validFingerprints[Math.floor(Math.random() * validFingerprints.length)];
        }

        params.set('fp', fp);
    }

    if (customName !== undefined){
        url.hash = `#${customName}`;
    }

    link = url.href.replace('https://', 'vless://');

    return link;
}

export default { generateUserData };