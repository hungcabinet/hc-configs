const source = {
    layout: 'per-user',
    pattern: /^awg.*\.conf$/i,
};

const AWG_V3_KEYS = [
    'HeaderProtectionKey',
    'ContentPaddingAddition',
    'RekeyAfterTime',
    'RekeyTimeout',
    'RejectAfterTime',
    'KeepaliveTimeout',
    'MaxHandshakeAttempts',
    'RandomTrailers',
    'DisableCookies',
];

function formatKeepalive(value) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    return trimmed;
}

function parseAmneziaBool(value) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'on' || trimmed === 'yes') {
        return { ok: true, value: true };
    }
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'off' || trimmed === 'no') {
        return { ok: true, value: false };
    }
    return { ok: false, value: false };
}

function hasAwgV3Keys(awgParams) {
    return AWG_V3_KEYS.some((key) => awgParams[key] !== undefined && awgParams[key] !== false);
}

function convertToSingBoxEntity(parsed, tag, domainResolver) {
    const { interface: iface, peers } = parsed;
    const awgParams = iface.awg;

    const entity = {
        address: iface.address,
        private_key: iface.privateKey,
        tag,
        mtu: iface.mtu,
        type: "awg",
        //domain_resolver: domainResolver,

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

        peers: peers.map((peer) => ({
            address: peer.endpointHost,
            port: peer.endpointPort,
            allowed_ips: peer.allowedIPsList,
            persistent_keepalive_interval: formatKeepalive(peer.PersistentKeepalive),
            preshared_key: peer.PresharedKey,
            public_key: peer.PublicKey,
        }))
    };

    if (awgParams.HeaderProtectionKey !== undefined) {
        entity.header_protection_key = awgParams.HeaderProtectionKey;
    }
    if (awgParams.ContentPaddingAddition !== undefined) {
        entity.content_padding_addition = awgParams.ContentPaddingAddition;
    }
    if (awgParams.RekeyAfterTime !== undefined) {
        entity.rekey_after_time = awgParams.RekeyAfterTime;
    }
    if (awgParams.RekeyTimeout !== undefined) {
        entity.rekey_timeout = awgParams.RekeyTimeout;
    }
    if (awgParams.RejectAfterTime !== undefined) {
        entity.reject_after_time = awgParams.RejectAfterTime;
    }
    if (awgParams.KeepaliveTimeout !== undefined) {
        entity.keepalive_timeout = awgParams.KeepaliveTimeout;
    }
    if (awgParams.MaxHandshakeAttempts !== undefined) {
        entity.max_handshake_attempts = awgParams.MaxHandshakeAttempts;
    }
    if (awgParams.RandomTrailers) {
        entity.random_trailers = true;
    }
    if (awgParams.DisableCookies) {
        entity.disable_cookies = true;
    }

    return entity;
}

function normalizeInterfaceAddress(addr) {
    if (addr.includes('/')) return addr;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return `${addr}/32`;
    return addr;
}

function pickAddressByVersion(addresses, version) {
    return addresses.find((addr) => {
        const host = addr.split('/')[0];
        const isIpv6 = host.includes(':');
        return version === 6 ? isIpv6 : !isIpv6;
    });
}

function convertMihomoEntity(parsed, tag) {
    const { interface: iface, peers } = parsed;
    const awgParams = iface.awg;
    const ip = pickAddressByVersion(iface.address, 4);
    const ipv6 = pickAddressByVersion(iface.address, 6);

    const amneziaOption = {
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
    };

    if (hasAwgV3Keys(awgParams)) {
        amneziaOption.version = 3;
    }
    if (awgParams.HeaderProtectionKey !== undefined) {
        amneziaOption['header-protection-key'] = awgParams.HeaderProtectionKey;
    }
    if (awgParams.ContentPaddingAddition !== undefined) {
        amneziaOption['content-padding-addition'] = awgParams.ContentPaddingAddition;
    }
    if (awgParams.RekeyAfterTime !== undefined) {
        amneziaOption['rekey-after-time'] = awgParams.RekeyAfterTime;
    }
    if (awgParams.RekeyTimeout !== undefined) {
        amneziaOption['rekey-timeout'] = awgParams.RekeyTimeout;
    }
    if (awgParams.RejectAfterTime !== undefined) {
        amneziaOption['reject-after-time'] = awgParams.RejectAfterTime;
    }
    if (awgParams.KeepaliveTimeout !== undefined) {
        amneziaOption['keepalive-timeout'] = awgParams.KeepaliveTimeout;
    }
    if (awgParams.MaxHandshakeAttempts !== undefined) {
        amneziaOption['max-handshake-attempts'] = awgParams.MaxHandshakeAttempts;
    }
    if (awgParams.RandomTrailers) {
        amneziaOption['random-trailers'] = true;
    }
    if (awgParams.DisableCookies) {
        amneziaOption['disable-cookies'] = true;
    }

    const entity = {
        name: tag,
        type: "wireguard",
        "private-key": iface.privateKey,
        ip: ip,
        ipv6: ipv6,
        peers: peers.map((peer) => ({
            server: peer.endpointHost,
            port: peer.endpointPort,
            "public-key": peer.PublicKey,
            "pre-shared-key": peer.PresharedKey,
            "allowed-ips": peer.allowedIPsList,
            "persistent-keepalive": formatKeepalive(peer.PersistentKeepalive),
        })),
        udp: true,
        mtu: iface.mtu,
        "amnezia-wg-option": amneziaOption,
    };

    return entity;
}

function parseData(configString, tag = 'proxy', domainResolver = 'google') {
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
            'I5': "string",

            'HeaderProtectionKey': "string",
            'ContentPaddingAddition': "string",
            'RekeyAfterTime': "string",
            'RekeyTimeout': "string",
            'RejectAfterTime': "string",
            'KeepaliveTimeout': "string",
            'MaxHandshakeAttempts': "string",

            'RandomTrailers': "bool",
            'DisableCookies': "bool",
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
                    case "bool": {
                        const parsedBool = parseAmneziaBool(interfaceSection[key]);
                        if (!parsedBool.ok) {
                            warnings.push(
                                `${key}: неизвестное bool-значение "${interfaceSection[key]}"`
                            );
                        }
                        awgParams[key] = parsedBool.value;
                        break;
                    }
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
                    .map(a => normalizeInterfaceAddress(a.trim()))
                    .filter(Boolean);
        } else {
            warnings.push(
                'Отсутствует Address в [Interface]'
            );
        }

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

        const parseSucceeded = errors.length === 0;

        return {
            success: parseSucceeded,
            singBoxEntity: parseSucceeded ? convertToSingBoxEntity(parsed, tag, domainResolver) : undefined,
            singBoxConverterErrors : [],
            mihomoEntity: parseSucceeded ? convertMihomoEntity(parsed, tag) : undefined,
            mihomoConverterErrors : [],
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

export default { source, parseData };
