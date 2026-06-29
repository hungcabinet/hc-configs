import path from 'path';
import config from './config.js';
import urlAuth from './urlAuth.js';

const ROUTING_CONFIG_FILE = 'routing.sing-box.json';

const VALID_ROUTES = new Set(['direct', 'proxy']);
const VALID_TYPES = new Set(['cidrs', 'domains']);
const VALID_DOWNLOAD_DETOURS = new Set(['direct', 'proxy']);
const LIST_ROUTE_ORDER = ['direct', 'proxy'];
const LIST_TYPE_ORDER = ['cidrs', 'domains'];

let cachedRoutingData;

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

function resolveRulesetUrl(url, authOptions) {
    if (authOptions === undefined) {
        return url;
    }

    return urlAuth.embedBasicAuthInLink(
        url,
        authOptions.baseUrl,
        authOptions.userName,
        authOptions.password
    );
}

function normalizeRulesetDownload(rulesetDownload) {
    return {
        default: rulesetDownload?.default ?? 'direct',
        proxy: rulesetDownload?.proxy ?? [],
        direct: rulesetDownload?.direct ?? [],
    };
}

function resolveDownloadDetour(url, rulesetDownload) {
    if (rulesetDownload.direct.includes(url)) {
        return 'direct';
    }
    if (rulesetDownload.proxy.includes(url)) {
        return 'proxy';
    }

    return rulesetDownload.default;
}

function tagFromListUrl(url, type) {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const source = parts[1];
    const base = path.basename(url, '.srs');

    return `${source}-${base}-${type}`;
}

function normalizeApps(apps) {
    if (Array.isArray(apps)) {
        return { direct: apps, proxy: [] };
    }

    if (apps === undefined || apps === null) {
        return { direct: [], proxy: [] };
    }

    return {
        direct: apps.direct ?? [],
        proxy: apps.proxy ?? [],
    };
}

function flattenLegacyLists(lists) {
    return lists.map((list) => ({
        route: list.route,
        type: list.type,
        url: list.url,
    }));
}

function flattenGroupedLists(lists) {
    const result = [];

    for (const route of LIST_ROUTE_ORDER) {
        const routeLists = lists[route];

        if (routeLists === undefined) {
            continue;
        }

        if (typeof routeLists !== 'object' || Array.isArray(routeLists)) {
            continue;
        }

        for (const type of LIST_TYPE_ORDER) {
            const urls = routeLists[type];

            if (urls === undefined) {
                continue;
            }

            if (!Array.isArray(urls)) {
                continue;
            }

            for (const url of urls) {
                result.push({ route, type, url });
            }
        }
    }

    return result;
}

function normalizeLists(lists) {
    if (lists === undefined || lists === null) {
        return [];
    }

    if (Array.isArray(lists)) {
        return flattenLegacyLists(lists);
    }

    return flattenGroupedLists(lists);
}

function enrichLists(lists) {
    return lists.map((list) => ({
        ...list,
        tag: tagFromListUrl(list.url, list.type),
    }));
}

function validateAppList(list, label, errors) {
    if (!Array.isArray(list)) {
        errors.push(`apps.${label} должен быть массивом`);
        return;
    }

    const seen = new Set();

    for (const [index, packageName] of list.entries()) {
        if (typeof packageName !== 'string' || packageName.length === 0) {
            errors.push(`apps.${label}[${index}]: package name должен быть непустой строкой`);
            continue;
        }

        if (seen.has(packageName)) {
            errors.push(`apps.${label}[${index}]: дублирующийся package name ${packageName}`);
        }

        seen.add(packageName);
    }
}

function validateUrlList(urls, pathLabel, errors, tags) {
    if (!Array.isArray(urls)) {
        errors.push(`${pathLabel} должен быть массивом url`);
        return;
    }

    for (const [index, url] of urls.entries()) {
        if (typeof url !== 'string' || url.length === 0) {
            errors.push(`${pathLabel}[${index}]: url должен быть непустой строкой`);
            continue;
        }

        try {
            new URL(url);
        } catch {
            errors.push(`${pathLabel}[${index}]: некорректный url`);
            continue;
        }

        const type = pathLabel.split('.').at(-1);
        const tag = tagFromListUrl(url, type);

        if (tags.has(tag)) {
            errors.push(`${pathLabel}[${index}]: дублирующийся tag ${tag}`);
        }

        tags.add(tag);
    }
}

function validateLegacyLists(lists, errors, tags) {
    for (const [index, list] of lists.entries()) {
        if (!VALID_ROUTES.has(list.route)) {
            errors.push(`lists[${index}]: route должен быть direct или proxy`);
        }

        if (!VALID_TYPES.has(list.type)) {
            errors.push(`lists[${index}]: type должен быть cidrs или domains`);
        }

        if (!list.url) {
            errors.push(`lists[${index}]: url обязателен`);
            continue;
        }

        try {
            new URL(list.url);
        } catch {
            errors.push(`lists[${index}]: некорректный url`);
            continue;
        }

        const tag = tagFromListUrl(list.url, list.type);

        if (tags.has(tag)) {
            errors.push(`lists[${index}]: дублирующийся tag ${tag}`);
        }

        tags.add(tag);
    }
}

function validateGroupedLists(lists, errors, tags) {
    if (typeof lists !== 'object' || Array.isArray(lists)) {
        errors.push('lists должен быть объектом { direct, proxy } или массивом (legacy)');
        return;
    }

    for (const route of Object.keys(lists)) {
        if (!VALID_ROUTES.has(route)) {
            errors.push(`lists.${route}: неизвестный route, ожидается direct или proxy`);
        }
    }

    for (const route of LIST_ROUTE_ORDER) {
        const routeLists = lists[route];

        if (routeLists === undefined) {
            continue;
        }

        if (typeof routeLists !== 'object' || Array.isArray(routeLists)) {
            errors.push(`lists.${route} должен быть объектом { cidrs, domains }`);
            continue;
        }

        for (const type of Object.keys(routeLists)) {
            if (!VALID_TYPES.has(type)) {
                errors.push(`lists.${route}.${type}: неизвестный type, ожидается cidrs или domains`);
            }
        }

        for (const type of LIST_TYPE_ORDER) {
            const urls = routeLists[type];

            if (urls === undefined) {
                continue;
            }

            validateUrlList(urls, `lists.${route}.${type}`, errors, tags);
        }
    }
}

function validateRulesetDownload(rulesetDownload, listUrls, errors) {
    const normalized = normalizeRulesetDownload(rulesetDownload);

    if (rulesetDownload !== undefined && typeof rulesetDownload !== 'object') {
        errors.push('rulesetDownload должен быть объектом { default, proxy }');
        return;
    }

    if (!VALID_DOWNLOAD_DETOURS.has(normalized.default)) {
        errors.push('rulesetDownload.default должен быть direct или proxy');
    }

    if (!Array.isArray(normalized.proxy)) {
        errors.push('rulesetDownload.proxy должен быть массивом url');
        return;
    }

    const seen = new Set();

    for (const [index, url] of normalized.proxy.entries()) {
        if (typeof url !== 'string' || url.length === 0) {
            errors.push(`rulesetDownload.proxy[${index}]: url должен быть непустой строкой`);
            continue;
        }

        try {
            new URL(url);
        } catch {
            errors.push(`rulesetDownload.proxy[${index}]: некорректный url`);
            continue;
        }

        if (seen.has(url)) {
            errors.push(`rulesetDownload.proxy[${index}]: дублирующийся url`);
        }

        seen.add(url);

        if (!listUrls.has(url)) {
            errors.push(`rulesetDownload.proxy[${index}]: url не найден в lists`);
        }
    }
}

function validateRoutingData(data) {
    const errors = [];

    if (data.lists !== undefined && typeof data.lists !== 'object') {
        errors.push('lists должен быть объектом или массивом');
    }

    if (data.apps !== undefined && !Array.isArray(data.apps) && typeof data.apps !== 'object') {
        errors.push('apps должен быть объектом { direct, proxy } или массивом (legacy)');
    }

    if (!data.dns?.servers || !Array.isArray(data.dns.servers)) {
        errors.push('dns.servers должен быть массивом');
    }

    if (!data.dns?.directServer) {
        errors.push('dns.directServer обязателен');
    }

    if (!data.dns?.defaultServer) {
        errors.push('dns.defaultServer обязателен');
    }

    const apps = normalizeApps(data.apps);

    validateAppList(apps.direct, 'direct', errors);
    validateAppList(apps.proxy, 'proxy', errors);

    const directApps = new Set(apps.direct);
    for (const packageName of apps.proxy) {
        if (directApps.has(packageName)) {
            errors.push(`apps: package name ${packageName} указан и в direct, и в proxy`);
        }
    }

    const tags = new Set();

    if (Array.isArray(data.lists)) {
        validateLegacyLists(data.lists, errors, tags);
    } else if (data.lists !== undefined) {
        validateGroupedLists(data.lists, errors, tags);
    }

    const listUrls = new Set(normalizeLists(data.lists).map((list) => list.url));
    validateRulesetDownload(data.rulesetDownload, listUrls, errors);

    if (errors.length > 0) {
        const error = new Error(`Ошибки в ${ROUTING_CONFIG_FILE}:\n  - ${errors.join('\n  - ')}`);
        error.code = 'ROUTING_INVALID';
        throw error;
    }
}

function loadRoutingData() {
    if (cachedRoutingData !== undefined) {
        return cachedRoutingData;
    }

    const raw = config.getConfigContent(ROUTING_CONFIG_FILE);
    const data = JSON.parse(raw);

    validateRoutingData(data);

    cachedRoutingData = {
        ...data,
        apps: normalizeApps(data.apps),
        lists: enrichLists(normalizeLists(data.lists)),
        rulesetDownload: normalizeRulesetDownload(data.rulesetDownload),
    };

    return cachedRoutingData;
}

function groupListTags(lists, route, type) {
    return lists
        .filter((list) => list.route === route && list.type === type)
        .map((list) => list.tag);
}

function buildRuleSets(lists, authOptions, rulesetDownload) {
    if (lists.length === 0) {
        return [];
    }

    return lists.map((list) => ({
        format: 'binary',
        tag: list.tag,
        type: 'remote',
        url: resolveRulesetUrl(list.url, authOptions),
        download_detour: resolveDownloadDetour(list.url, rulesetDownload),
    }));
}

function pushAppRouteRule(routeRules, outbound, packageNames) {
    if (packageNames.length === 0) {
        return;
    }

    routeRules.push({
        action: 'route',
        outbound,
        package_name: packageNames,
    });
}

function pushListRouteRule(routeRules, outbound, lists, type) {
    const tags = groupListTags(lists, outbound, type);

    if (tags.length === 0) {
        return;
    }

    routeRules.push({
        action: 'route',
        outbound,
        rule_set: tags
    });
}

function buildSingBoxRouting(routingData, authOptions) {
    const { lists, apps, dns, rulesetDownload } = routingData;
    const directDomainTags = groupListTags(lists, 'direct', 'domains');

    const dnsRules = [];

    if (directDomainTags.length > 0) {
        dnsRules.push({
            action: 'route',
            rule_set: directDomainTags,
            server: dns.directServer,
            strategy: 'prefer_ipv4',
        });
    }

    if (apps.direct.length > 0) {
        dnsRules.push({
            action: 'route',
            package_name: apps.direct,
            server: dns.directServer,
            strategy: 'prefer_ipv4',
        });
    }

    if (apps.proxy.length > 0) {
        dnsRules.push({
            action: 'route',
            package_name: apps.proxy,
            server: dns.defaultServer,
            strategy: 'prefer_ipv4',
        });
    }

    dnsRules.push({
        action: 'route',
        server: dns.defaultServer,
        strategy: 'prefer_ipv4',
    });

    const routeRules = [
        { action: 'sniff' },
        { protocol: 'dns', action: 'hijack-dns' },
        { action: 'resolve', strategy: 'prefer_ipv4' },
    ];

    pushAppRouteRule(routeRules, 'direct', apps.direct);
    pushListRouteRule(routeRules, 'direct', lists, 'cidrs');
    pushListRouteRule(routeRules, 'direct', lists, 'domains');
    pushAppRouteRule(routeRules, 'proxy', apps.proxy);
    pushListRouteRule(routeRules, 'proxy', lists, 'cidrs');
    pushListRouteRule(routeRules, 'proxy', lists, 'domains');

    return {
        dns: {
            servers: dns.servers,
            rules: dnsRules,
            final: dns.defaultServer,
            strategy: 'prefer_ipv4',
            disable_cache: false,
            independent_cache: false,
        },
        route: {
            rule_set: buildRuleSets(lists, authOptions, rulesetDownload),
            rules: routeRules,
        },
    };
}

function buildThroneRoutes(routingData, authOptions) {
    const direct = [];
    const proxy = [];

    for (const list of routingData.lists) {
        const line = `ruleset:${resolveRulesetUrl(list.url, authOptions)}`;
        (list.route === 'direct' ? direct : proxy).push(line);
    }

    return { direct, proxy };
}

export default {
    loadRoutingData,
    buildSingBoxRouting,
    buildThroneRoutes,
    getAuthOptionsForUser,
    resolveRulesetUrl,
    tagFromListUrl,
    normalizeApps,
    normalizeLists,
    normalizeRulesetDownload,
    resolveDownloadDetour,
};