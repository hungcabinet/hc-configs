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

function parseData(configData, endpoint = undefined, userName, tag = 'proxy') {
    const warnings = [];
    const parseErrors = [];
    const userProfiles = getMieruListeners(configData).flatMap(listener => {
        const users = listener?.users && typeof listener.users === 'object'
            ? listener.users
            : {};
        const password = users[userName];

        if (typeof password !== 'string' || password === '') {
            return [];
        }

        return [{
            ...listener,
            username: userName,
            password
        }];
    });

    if (userProfiles.length === 0) {
        parseErrors.push(`Mieru профиль для пользователя '${userName}' не найден`);
        return { success: false, warnings, errors: parseErrors };
    }

    if (userProfiles.length > 1) {
        warnings.push(`Найдено несколько mieru-профилей для '${userName}', используется первый`);
    }

    const profile = userProfiles[0];
    const server = endpoint || profile?.listen;
    const serverPort = Number.parseInt(profile?.port, 10);
    const username = profile?.username;
    const password = profile?.password;

    if (!server) {
        parseErrors.push('IP эндпоинт не задан и не найдено поле listen');
    }
    if (!Number.isInteger(serverPort) || serverPort <= 0 || serverPort > 65535) {
        parseErrors.push('Поле port должно быть числом от 1 до 65535');
    }
    if (!username) {
        parseErrors.push('Не заполнено поле username');
    }
    if (!password) {
        parseErrors.push('Не заполнено поле password');
    }

    const trafficPattern = profile['traffic-pattern'] ?? profile.traffic_pattern;
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
        transport: profile?.transport,
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

export default { source, readConfig, getUsers, parseData };