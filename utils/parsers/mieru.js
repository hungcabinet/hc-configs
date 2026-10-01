import fs from 'fs';

import yaml from 'js-yaml';

const source = {
    layout: 'server-shared',
    pattern: /^(mieru|mihomo).*\.(yaml|yml)$/i,
    getUsers(configPath) {
        const configData = readConfig(configPath);
        return getUsers(configData);
    },
};

function readConfig(configPath) {
    return yaml.load(fs.readFileSync(configPath, 'utf-8')) || {};
}

function getMieruListeners(configData) {
    const listeners = Array.isArray(configData?.listeners) ? configData.listeners : [];
    return listeners.filter(listener => String(listener?.type || '').toLowerCase() === 'mieru');
}

function getListenerName(listener) {
    return typeof listener?.name === 'string' ? listener.name.trim() : '';
}

function getTransportDisplayNote(transport) {
    const value = String(transport || 'TCP').toUpperCase();
    return value === 'UDP' ? 'UDP транспорт' : 'TCP транспорт';
}

function getListenerUserPassword(listener, userName) {
    const users = listener?.users && typeof listener.users === 'object'
        ? listener.users
        : {};
    const password = users[userName];

    return typeof password === 'string' && password !== '' ? password : undefined;
}

function getUsers(configData) {
    const users = getMieruListeners(configData)
        .flatMap(listener => Object.keys(listener?.users || {}))
        .filter(value => typeof value === 'string' && value.trim() !== '');

    return [...new Set(users)];
}

function convertToSingBoxEntity(warnings, convertErrors, parsed, tag) {
    let transport = String(parsed.transport || 'TCP').toUpperCase();

    if (transport !== 'TCP' && transport !== 'UDP') {
        warnings.push(`transport='${parsed.transport}' не поддерживается sing-box, используется TCP`);
        transport = 'TCP';
    }

    if (convertErrors.length > 0) {
        return undefined;
    }

    const singBoxEntity = {
        type: 'mieru',
        tag,
        server: parsed.server,
        server_port: parsed.serverPort,
        transport,
        username: parsed.username,
        password: parsed.password,
    };

    if (parsed.trafficPattern !== undefined && parsed.trafficPattern !== '') {
        singBoxEntity.traffic_pattern = parsed.trafficPattern;
    }

    return singBoxEntity;
}

function convertToMihomoEntity(warnings, convertErrors, parsed, tag){
    let transport = String(parsed.transport || 'TCP').toUpperCase();

    if (transport !== 'TCP' && transport !== 'UDP') {
        warnings.push(`transport='${parsed.transport}' не поддерживается mihomo, используется TCP`);
        transport = 'TCP';
    }

    if (convertErrors.length > 0) {
        return undefined;
    }

    let mihomoEntity = {
        name: tag,
        type: 'mieru',
        server: parsed.server,
        port: parsed.serverPort,
        transport,
        username: parsed.username,
        password: parsed.password,
    };

    if (parsed.trafficPattern !== undefined) {
        mihomoEntity["traffic-pattern"] = parsed.trafficPattern;
    }

    return mihomoEntity;
}

function parseData(configData, endpoint = undefined, userName, listener, tag = 'proxy') {
    const warnings = [];
    const parseErrors = [];
    const listenerName = getListenerName(listener);

    if (!listenerName) {
        parseErrors.push('Не заполнено поле name у листенера mieru');
    }

    const password = getListenerUserPassword(listener, userName);

    if (!password) {
        parseErrors.push(`Mieru профиль для пользователя '${userName}' не найден`);
        return { success: false, warnings, errors: parseErrors };
    }

    const server = endpoint || listener?.listen;
    const serverPort = Number.parseInt(listener?.port, 10);
    const username = userName;

    if (!server) {
        parseErrors.push('IP эндпоинт не задан и не найдено поле listen');
    }
    if (!Number.isInteger(serverPort) || serverPort <= 0 || serverPort > 65535) {
        parseErrors.push('Поле port должно быть числом от 1 до 65535');
    }
    if (!username) {
        parseErrors.push('Не заполнено поле username');
    }

    const trafficPattern = listener?.['traffic-pattern'] ?? listener?.traffic_pattern;
    if (trafficPattern !== undefined && typeof trafficPattern !== 'string') {
        parseErrors.push('Поле traffic-pattern должно быть строкой');
    }

    if (parseErrors.length > 0) {
        return { success: false, warnings, errors: parseErrors };
    }

    const parsed = {
        server,
        serverPort,
        username,
        password,
        transport: listener?.transport,
        trafficPattern,
        tunExclude: /^\d{1,3}(\.\d{1,3}){3}$/.test(server) ? [`${server}/32`] : [],
    };

    const singBoxConvertErrors = [];
    const singBoxEntity = convertToSingBoxEntity(warnings, singBoxConvertErrors, parsed, tag);

    const mihomoConvertErrors = [];
    const mihomoEntity = convertToMihomoEntity(warnings, singBoxConvertErrors, parsed, tag);

    return {
        success: true,
        warnings,
        errors: [],
        singBoxEntity,
        singBoxConvertErrors,
        mihomoEntity,
        mihomoConvertErrors,
        parsed
    };
}

function buildMieruLink(parsed, connectionName) {
    let transport = String(parsed.transport || 'TCP').toUpperCase();

    if (transport !== 'TCP' && transport !== 'UDP') {
        transport = 'TCP';
    }

    const url = new URL(`https://${parsed.server}`);

    url.username = parsed.username;
    url.password = parsed.password;
    url.searchParams.set('port', String(parsed.serverPort));
    url.searchParams.set('protocol', transport);
    url.hash = connectionName;

    return url.href
        .replace('https://', 'mierus://')
        .replace(`${parsed.server}/?`, `${parsed.server}?`);
}

export default {
    source,
    readConfig,
    getUsers,
    getMieruListeners,
    getListenerName,
    getListenerUserPassword,
    getTransportDisplayNote,
    parseData,
    buildMieruLink,
};