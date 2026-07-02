import config from './config.js';

function isHttpUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
}

function getAuthOptionsForUser(user) {
    const webConfig = config.getWebServerConfig();

    if (!webConfig.enabled) {
        return undefined;
    }

    const webUser = webConfig.users?.find((entry) => entry.userName === user);

    return {
        baseUrl: webConfig.baseUrl,
        userName: webUser?.userName,
        password: webUser?.password,
    };
}

function enrichUrl(link, authOptions) {
    if (authOptions === undefined) {
        return link;
    }

    return embedBasicAuthInLink(
        link,
        authOptions.baseUrl,
        authOptions.userName,
        authOptions.password
    );
}

function enrichUrlsInValue(value, authOptions) {
    if (authOptions === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        return enrichUrl(value, authOptions);
    }

    if (Array.isArray(value)) {
        return value.map((item) => enrichUrlsInValue(item, authOptions));
    }

    if (value !== null && typeof value === 'object') {
        const result = {};

        for (const [key, val] of Object.entries(value)) {
            result[key] = enrichUrlsInValue(val, authOptions);
        }

        return result;
    }

    return value;
}

function enrichThroneLine(line, authOptions) {
    const prefix = 'ruleset:';

    if (!line.startsWith(prefix)) {
        return line;
    }

    return `${prefix}${enrichUrl(line.slice(prefix.length), authOptions)}`;
}

/**
 * Проверяет, относится ли ссылка к baseUrl веб-сервера и может получить basic-auth.
 *
 * @param {string} link
 * @param {string} baseUrl
 * @returns {boolean}
 */
function needsBasicAuthInLink(link, baseUrl) {
    if (typeof link !== 'string' || link.length === 0) {
        return false;
    }

    let url;
    try {
        url = new URL(link);
    } catch {
        return false;
    }

    if (!isHttpUrl(url)) {
        return false;
    }

    let base;
    try {
        base = new URL(baseUrl);
    } catch {
        return false;
    }

    return url.origin === base.origin;
}

/**
 * Если ссылка относится к baseUrl веб-сервера, встраивает в неё basic-auth.
 * Невалидные и внешние ссылки возвращаются без изменений.
 *
 * @param {string} link
 * @param {string} baseUrl
 * @param {string} [userName]
 * @param {string} [password]
 * @returns {string}
 */
function getBasicAuthHeader(authOptions, link) {
    if (authOptions === undefined) {
        return undefined;
    }

    if (!needsBasicAuthInLink(link, authOptions.baseUrl)) {
        return undefined;
    }

    const { userName, password } = authOptions;

    if (userName === undefined || userName === null || userName === '') {
        return undefined;
    }

    const token = Buffer.from(`${userName}:${password ?? ''}`).toString('base64');

    return `Basic ${token}`;
}

function embedBasicAuthInLink(link, baseUrl, userName, password) {
    if (!needsBasicAuthInLink(link, baseUrl)) {
        return link;
    }

    if (userName === undefined || userName === null || userName === '') {
        return link;
    }

    let url = new URL(link);
    url.username = userName;
    url.password = password ?? '';

    return url.href;
}

export default {
    needsBasicAuthInLink,
    embedBasicAuthInLink,
    getBasicAuthHeader,
    getAuthOptionsForUser,
    enrichUrl,
    enrichUrlsInValue,
    enrichThroneLine,
};
