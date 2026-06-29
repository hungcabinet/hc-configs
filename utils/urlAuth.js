function isHttpUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
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

export default { needsBasicAuthInLink, embedBasicAuthInLink };
