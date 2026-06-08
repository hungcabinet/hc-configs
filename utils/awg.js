import path from "path";
import fs from "fs";
import singBox from "./singBox.js";
import files from "./files.js";
import contextUtil from "./context.js";
import webSite from "./webSite.js";
import android from "./android.js";
import config from "./config.js";
import throne from "./throne.js";

function toEndpoint(configString, tag = 'proxy', domainResolver = 'google') {
    const warnings = [];
    const errors = [];

    try {

        if (!configString || typeof configString !== 'string') {
            errors.push('configString пуст или не строка');
            return { success: false, warnings, errors };
        }

        // =========================
        // Парсинг секций
        // =========================

        const lines = configString
            .replace(/\r/g, '')
            .split('\n');

        let currentSection = null;

        const interfaceSection = {};
        const peers = [];

        let currentPeer = null;

        for (let rawLine of lines) {

            let line = rawLine.trim();

            if (!line) continue;

            // Убираем inline комментарии
            line = line.split('#')[0].trim();
            if (!line) continue;

            // --- Секция ---
            const sectionMatch = line.match(/^\[(.+?)\]$/);

            if (sectionMatch) {

                const sectionName =
                    sectionMatch[1].trim();

                currentSection = sectionName;

                if (sectionName === 'Peer') {

                    currentPeer = {};
                    peers.push(currentPeer);

                }

                continue;
            }

            // --- Параметры ---
            const kvMatch =
                line.match(/^([^=]+)=(.+)$/);

            if (!kvMatch) {
                warnings.push(
                    `Невалидная строка: ${line}`
                );
                continue;
            }

            const key = kvMatch[1].trim();
            const value = kvMatch[2].trim();

            // Interface
            if (currentSection === 'Interface') {

                interfaceSection[key] = value;

            }

            // Peer
            if (currentSection === 'Peer' && currentPeer) {

                currentPeer[key] = value;

            }

        }

        // =========================
        // Проверки Interface
        // =========================

        if (!Object.keys(interfaceSection).length) {
            errors.push(
                'Отсутствует секция [Interface]'
            );
        }

        const privateKey =
            interfaceSection.PrivateKey;

        if (!privateKey) {
            errors.push(
                'Отсутствует PrivateKey в [Interface]'
            );
        }

        // =========================
        // Проверки Peer
        // =========================

        if (peers.length === 0) {
            errors.push(
                'Отсутствует хотя бы один [Peer]'
            );
        }

        // =========================
        // Endpoint parsing
        // =========================

        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];

            if (!peer.PublicKey) {
                errors.push(
                    `Peer #${i + 1}: отсутствует PublicKey`
                );
            }

            if (!peer.Endpoint) {
                errors.push(
                    `Peer #${i + 1}: отсутствует Endpoint`
                );
                continue;
            }

            const parts =
                peer.Endpoint.split(':');

            if (parts.length !== 2) {
                errors.push(
                    `Peer #${i + 1}: Endpoint должен быть host:port`
                );
                continue;
            }

            peer.endpointHost = parts[0];

            const port = parseInt(parts[1]);

            if (isNaN(port)) {
                errors.push(
                    `Peer #${i + 1}: неверный порт Endpoint`
                );
            } else {
                peer.endpointPort = port;
            }

            // AllowedIPs

            if (peer.AllowedIPs) {
                peer.allowedIPsList =
                    peer.AllowedIPs
                        .split(',')
                        .map(ip => ip.trim())
                        .filter(Boolean);
            } else {
                warnings.push(
                    `Peer #${i + 1}: отсутствует AllowedIPs`
                );
            }

        }

        // =========================
        // AWG параметры
        // =========================

        const awgParams = {};

        const awgKeys = {

            'Jc': "int",
            'Jmin': "int",
            'Jmax': "int",

            'S1': "int",
            'S2': "int",
            'S3': "int",
            'S4': "int",

            'H1': "string",
            'H2': "string",
            'H3': "string",
            'H4': "string",

            'I1': "string",
            'I2': "string",
            'I3': "string",
            'I4': "string",
            'I5': "string"
        };

        for (const key in awgKeys) {
            let type = awgKeys[key];

            if (interfaceSection[key] !== undefined) {
                switch (type) {
                    case "int":
                        let val =
                            parseInt(interfaceSection[key]);

                        if (isNaN(val)) {

                            warnings.push(
                                `${key} не число`
                            );

                        }

                        awgParams[key] = val;
                        break;
                    case "string":
                        awgParams[key] = interfaceSection[key];
                        break;
                }
            }
        }

        // Проверка диапазонов J*

        if (
            awgParams.Jmin !== undefined &&
            awgParams.Jmax !== undefined
        ) {
            if (awgParams.Jmin > awgParams.Jmax) {
                errors.push(
                    'Jmin больше Jmax'
                );
            }
        }

        // =========================
        // DNS
        // =========================

        let dnsList = [];

        if (interfaceSection.DNS) {
            dnsList =
                interfaceSection.DNS
                    .split(',')
                    .map(d => d.trim())
                    .filter(Boolean);
        }

        // =========================
        // Address
        // =========================

        let addressList = [];

        if (interfaceSection.Address) {
            addressList =
                interfaceSection.Address
                    .split(',')
                    .map(a => a.trim())
                    .filter(Boolean);
        } else {
            warnings.push(
                'Отсутствует Address в [Interface]'
            );
        }

        // =========================
        // Собираем endpoint
        // =========================

        let endpoint = {
            address: addressList,
            private_key: privateKey,
            tag: tag,
            mtu:
                interfaceSection.MTU
                    ? parseInt(interfaceSection.MTU)
                    : undefined,
            type: "awg",
            domain_resolver: domainResolver,

            jc: awgParams.Jc,
            jmin: awgParams.Jmin,
            jmax: awgParams.Jmax,

            h1: awgParams.H1,
            h2: awgParams.H2,
            h3: awgParams.H3,
            h4: awgParams.H4,

            s1: awgParams.S1,
            s2: awgParams.S2,
            s3: awgParams.S3,
            s4: awgParams.S4,

            i1: awgParams.I1,
            i2: awgParams.I2,
            i3: awgParams.I3,
            i4: awgParams.I4,
            i5: awgParams.I5,

            peers: peers.map((peer) => {
                return {
                    address: peer.endpointHost,
                    port: peer.endpointPort,
                    allowed_ips: peer.allowedIPsList,
                    persistent_keepalive_interval: parseInt(peer.PersistentKeepalive),
                    preshared_key: peer.PresharedKey,
                    public_key: peer.PublicKey,
                }
            })
        }

        // =========================
        // Итоговый parsed
        // =========================

        const parsed = {

            interface: {
                privateKey,
                address: addressList,
                dns: dnsList,
                mtu:
                    interfaceSection.MTU
                        ? parseInt(interfaceSection.MTU)
                        : undefined,
                listenPort:
                    interfaceSection.ListenPort
                        ? parseInt(interfaceSection.ListenPort)
                        : undefined,
                awg: awgParams
            },

            peers
        };

        return {
            success: errors.length === 0,
            endpoint: endpoint,
            warnings,
            errors,
            parsed
        };

    } catch (err) {

        errors.push(
            `Неизвестная ошибка: ${err.message}`
        );

        return {

            success: false,
            warnings,
            errors

        };

    }
}

function generateUserData(userFileData){
    contextUtil.withProtocol("awg", () =>{
        let data = toEndpoint(fs.readFileSync(userFileData.path, "utf-8"));

        for (let j = 0; j < data.warnings.length; j++) {
            console.warn(`[WARN]: AWG ${userFileData.path} - ${data.warnings[j]}`);
        }

        for (let j = 0; j < data.errors.length; j++) {
            console.error(`[ERR]: AWG ${userFileData.path} - ${data.errors[j]}`);
        }

        if (!data.success){
            return;
        }

        let peerHosts = data.parsed.peers.map(value => `${value.endpointHost}/32`);

        let socksInbound = singBox.getSocksInbound();
        let tunInbound = singBox.getTunInbound(peerHosts);

        contextUtil.withPlatform("raw", () => {
            let rawDir = contextUtil.getRawDir();

            let outboundFilePath = files.saveJsonObject(data.endpoint, rawDir, "outbound");
            webSite.addUserFileLink(outboundFilePath, `[${contextUtil.getProtocol()}] endpoint для кастомных конфигов hc-box`, "outbound", ["download", "copy-data"]);

            let filePath = path.join(rawDir, `${files.getFileName()}.conf`);
            fs.copyFileSync(userFileData.path, filePath);
            webSite.addUserFileLink(filePath, `[${contextUtil.getProtocol()}] конфиг для AmneziaVPN или AmneziaWG`, "config", ["download", "copy-data"]);
        });

        contextUtil.withPlatform("android", () => {
            let androidConfig = singBox.getAndroidTemplate();

            androidConfig.endpoints.push(data.endpoint);

            android.processAndroidConfig(androidConfig, tunInbound, socksInbound);
        });

        contextUtil.withPlatform("ios", () => {
            let iosDir = contextUtil.getIosDir();
            let filePath = path.join(iosDir, `${files.getFileName("awg")}.conf`)

            fs.copyFileSync(userFileData.path, filePath);
            webSite.addUserFileLink(filePath, `[${contextUtil.getProtocol()}] конфиг для AmneziaVPN или AmneziaWG`, "config", ["download", "copy-data"]);
        });

        contextUtil.withPlatform("windows", () => {
            let winDir = contextUtil.getWinDir();

            let awgLinkFile =  path.join(winDir, `${files.getFileName("awg")}.link`);

            contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                winDir = contextUtil.getWinDir();
            });

            let linkData = throne.addAmneziaSubscription(winDir, data.parsed);
            fs.writeFileSync(awgLinkFile, linkData.link);

            webSite.addUserFileLink(awgLinkFile, `[${contextUtil.getProtocol()}] ссылка для Throne`, "link", ["download", "copy-data"]);

            contextUtil.withUserData(contextUtil.getUser(), "common", () => {
                webSite.addUserFileLink(linkData.filePath, `Подписка для Throne`, "subscription", ["copy-link"]);
            });
        });
    });
}

export default { generateUserData };