import yaml from 'js-yaml';
import config from './config.js';
import urlAuth from './urlAuth.js';

const MIHOMO_TEMPLATE_FILE = 'template.mihomo.yaml';
const PROXY_NAME = 'proxy';
const PROXY_GROUP_NAME = 'PROXY';

function stripProcessNameRules(rules) {
    if (!Array.isArray(rules)) {
        return rules;
    }

    return rules.filter((rule) => {
        if (typeof rule !== 'string') {
            return true;
        }

        return !rule.startsWith('PROCESS-NAME,') && !rule.startsWith('PROCESS-NAME-REGEX,');
    });
}

function enrichRuleProviders(ruleProviders, authOptions) {
    if (ruleProviders === undefined || ruleProviders === null || authOptions === undefined) {
        return ruleProviders;
    }

    const result = {};

    for (const [name, provider] of Object.entries(ruleProviders)) {
        if (provider === null || typeof provider !== 'object' || typeof provider.url !== 'string') {
            result[name] = provider;
            continue;
        }

        const authHeader = urlAuth.getBasicAuthHeader(authOptions, provider.url);

        if (authHeader === undefined) {
            result[name] = provider;
            continue;
        }

        result[name] = {
            ...provider,
            header: {
                ...(provider.header || {}),
                Authorization: [authHeader],
            },
        };
    }

    return result;
}

function getTemplate(ctx, { withoutAndroidApps = false } = {}) {
    const parsed = yaml.load(config.getConfigContent(MIHOMO_TEMPLATE_FILE)) || {};
    const authOptions = urlAuth.getAuthOptionsForUser(ctx?.user);

    if (withoutAndroidApps && parsed.rules !== undefined) {
        parsed.rules = stripProcessNameRules(parsed.rules);
    }

    if (parsed['rule-providers'] !== undefined) {
        parsed['rule-providers'] = enrichRuleProviders(parsed['rule-providers'], authOptions);
    }

    return structuredClone(parsed);
}

function buildClientConfig(template, proxyValue) {
    const clientConfig = structuredClone(template);
    const proxy = { ...proxyValue, name: PROXY_NAME };

    clientConfig.proxies = [proxy];

    for (const group of clientConfig['proxy-groups'] || []) {
        if (group.name === PROXY_GROUP_NAME) {
            group.proxies = [PROXY_NAME];
        }
    }

    return clientConfig;
}

function buildMultiProxyClientConfig(template, proxies) {
    const clientConfig = structuredClone(template);

    clientConfig.proxies = proxies.map((proxy) => structuredClone(proxy));

    for (const group of clientConfig['proxy-groups'] || []) {
        if (group.name === PROXY_GROUP_NAME) {
            group.proxies = proxies.map((proxy) => proxy.name);
        }
    }

    return clientConfig;
}

function getSubscriptionLink(ctx, originalLink, type, customName = undefined) {
    const encodedLink = encodeURIComponent(originalLink);
    const connectionName = encodeURIComponent(
        customName || `${ctx.serverDisplayName()} [${ctx.protocol} ${type}]`
    );

    return `clash://install-config?url=${encodedLink}&name=${connectionName}`;
}

export default {
    getTemplate,
    buildClientConfig,
    buildMultiProxyClientConfig,
    getSubscriptionLink,
    stripProcessNameRules,
    enrichRuleProviders,
};
