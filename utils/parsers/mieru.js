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

function toOutbound(configData, endpoint = undefined, userName, tag = 'proxy') {
    const warnings = [];
    const errors = [];
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
        errors.push(`Mieru профиль для пользователя '${userName}' не найден`);
        return { success: false, warnings, errors };
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
        errors.push('IP эндпоинт не задан и не найдено поле listen');
    }
    if (!Number.isInteger(serverPort) || serverPort <= 0 || serverPort > 65535) {
        errors.push('Поле port должно быть числом от 1 до 65535');
    }
    if (!username) {
        errors.push('Не заполнено поле username');
    }
    if (!password) {
        errors.push('Не заполнено поле password');
    }

    let transport = String(profile?.transport || 'TCP').toUpperCase();
    if (transport !== 'TCP' && transport !== 'UDP') {
        warnings.push(`transport='${profile?.transport}' не поддерживается, используется TCP`);
        transport = 'TCP';
    }

    const trafficPattern = profile['traffic-pattern'] ?? profile.traffic_pattern;
    if (trafficPattern !== undefined && typeof trafficPattern !== 'string') {
        errors.push('Поле traffic-pattern должно быть строкой');
    }

    if (errors.length > 0) {
        return { success: false, warnings, errors };
    }

    const outbound = {
        type: 'mieru',
        tag,
        server,
        server_port: serverPort,
        transport,
        username,
        password,
    };

    if (trafficPattern !== undefined && trafficPattern !== '') {
        outbound.traffic_pattern = trafficPattern;
    }

    return {
        success: true,
        warnings,
        errors,
        outbound,
        parsed: {
            server,
            serverPort,
            username,
            transport,
            tunExclude: /^\d{1,3}(\.\d{1,3}){3}$/.test(server) ? [`${server}/32`] : [],
        }
    };
}

export default { source, readConfig, getUsers, toOutbound };
