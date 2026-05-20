import fs from 'fs';
import contextUtil from "./context.js";
import singBox from "./singBox.js";
import config from "./config.js";
import files from "./files.js";
import webSite from "./webSite.js";
import merge from "deepmerge";
import android from "./android.js";
import path from "path";
import throne from "./throne.js";

function findObjects(obj, predicate, result = []) {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            findObjects(item, predicate, result);
        }
    } else if (obj && typeof obj === 'object') {
        if (predicate(obj)) {
            result.push(obj);
        }

        for (const value of Object.values(obj)) {
            findObjects(value, predicate, result);
        }
    }

    return result;
}

function getForwardProxyRoutes(configData){
    let servers = configData.apps?.http?.servers;

    let result = [];

    for (const serversKey in servers) {
        let server = servers[serversKey];

        let port = (server.listen || [undefined])[0]?.split(":")?.at(-1);
        if (port === undefined) {
            continue;
        }

        let routes = findObjects(
            server,
            obj =>
                'handler' in obj &&
                'auth_pass_deprecated' in obj &&
                'auth_user_deprecated' in obj &&
                obj.handler === 'forward_proxy'
        ).map(value => {
            return { port: port, route: value }
        });

        result = [...result, ...routes];
    }

    return result;
}

function getSni(configData){
    return (configData.apps?.tls?.certificates?.automate || [undefined])[0];
}

function getUsers(configPath){
    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return getForwardProxyRoutes(configData).flatMap(v1 => v1.route.auth_user_deprecated);
}

function toOutbound(configData, endpoint = undefined, withQuic = false, tag = 'proxy', domainResolver = 'google'){
    const warnings = [];
    const errors = [];

    getForwardProxyRoutes(configData);

    let userRoute = getForwardProxyRoutes(configData).find(value => value.route.auth_user_deprecated === contextUtil.getUser());
    if (userRoute === undefined){
        errors.push(`Пользователь '${contextUtil.getUser()}' не найден`);
        return { success: false, errors, warnings };
    }

    let sni = getSni(configData);
    if (sni === undefined){
        errors.push(`SNI не найден`);
        return { success: false, errors, warnings };
    }

    if (endpoint === undefined){
        errors.push(`IP эндпоинт не задан`);
        return { success: false, errors, warnings };
    }

    let outbound = {
        type: "naive",
        tag: tag,
        udp_over_tcp: {
            enabled: true,
            version: 2
        },
        server: endpoint,
        server_port: parseInt(userRoute.port),
        tls: {
            server_name: sni,
            enabled: true
        },
        username: userRoute.route.auth_user_deprecated,
        password: userRoute.route.auth_pass_deprecated
    };

    if (domainResolver) {
        outbound.domain_resolver = domainResolver;
    }

    if (withQuic) {
        outbound.quic = true;
        outbound.quic_congestion_control = "bbr2";
    }

    return {
        success: true,
        outbound,
        warnings,
        errors,
        parsed:{
            username: userRoute.route.auth_user_deprecated,
            password: userRoute.route.auth_pass_deprecated,
            endpoint,
            sni,
            port: parseInt(userRoute.port)
        }
    };
}

function generateUserData(userFileData){
    let protocols = [{
        name: "naive-https",
        quic: false,
    }]

    const naiveConfig = config.getVpnServerConfig(contextUtil.getServer()).naiveproxy;

    const useQuic = naiveConfig.useQuic;

    if (useQuic){
        protocols.push({
            name: "naive-quic",
            quic: true
        })
    }

    const configData = JSON.parse(fs.readFileSync(userFileData.path, "utf-8"));

    for (const protocol of protocols) {
        contextUtil.withProtocol(protocol.name, () =>{

            let ip  = naiveConfig.ip;

            let data = toOutbound(configData, ip, protocol.quic);

            for (let j = 0; j < data.warnings.length; j++) {
                console.warn(`[WARN]: Android ${protocol.name} ${userFileData.path} - ${data.warnings[j]}`);
            }

            for (let j = 0; j < data.errors.length; j++) {
                console.error(`[ERR]: Android ${protocol.name} ${userFileData.path} - ${data.errors[j]}`);
            }

            if (!data.success){
                return;
            }

            let tunInbound = singBox.getTunInbound([`${ip}/32`]);

            contextUtil.withPlatform("raw", () => {
                let rawDir = contextUtil.getRawDir();

                let outboundFilePath = files.saveJsonObject(data.outbound, rawDir, "https-outbound");
                webSite.addUserFileLink(outboundFilePath, `[${contextUtil.getProtocol()}] outbound для кастомных конфигов hc-box или sing-box`, "outbound", ["download", "copy-data"]);
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

                let linkUrl = new URL(`https://${data.parsed.sni}`);

                linkUrl.searchParams.set("uot", "1");
                if (protocol.quic){
                    linkUrl.searchParams.set("congestion_control", "bbr2");
                }
                linkUrl.searchParams.set("security", "tls");

                linkUrl.username = data.parsed.username;
                linkUrl.password = data.parsed.password;

                linkUrl.hash = `${contextUtil.getServer()} [${contextUtil.getProtocol()}]`;

                let link = linkUrl.href
                    .replace("https://", protocol.quic ? "naive+quic://" : "naive+https://")
                    .replace(`${data.parsed.sni}/?`, `${data.parsed.sni}:${data.parsed.port}?`)
                    .replace("security=tls", "security=tls&alpn");

                let linkFilePath = path.join(winDir, `${files.getFileName()}.link`);
                fs.writeFileSync(linkFilePath, link);
                webSite.addUserFileLink(linkFilePath, `[${contextUtil.getProtocol()}] ссылка для Throne`, "link", ["download", "copy-data"]);

                contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                    winDir = contextUtil.getWinDir();
                });

                let subscriptionFilePath = throne.addLinkToSubscription(winDir, link);

                contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                    webSite.addUserFileLink(subscriptionFilePath, `Подписка для Throne`, "subscription", ["copy-link"]);
                });
            });
        });
    }
}

export default { getUsers, generateUserData };