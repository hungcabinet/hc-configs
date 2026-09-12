import fs from "fs";
import path from "path";
import base64url from "base64url";
import config from "./config.js";
import urlAuth from "./urlAuth.js";

const THRONE_DIRECT_FILE = 'throne.direct.txt';
const THRONE_PROXY_FILE = 'throne.proxy.txt';

function readThroneLines(fileName) {
    const content = config.getConfigContent(fileName);

    return content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function extractWindowsRoutes(ctx){
    const authOptions = urlAuth.getAuthOptionsForUser(ctx?.user);

    return {
        direct: readThroneLines(THRONE_DIRECT_FILE).map((line) => urlAuth.enrichThroneLine(line, authOptions)),
        proxy: readThroneLines(THRONE_PROXY_FILE).map((line) => urlAuth.enrichThroneLine(line, authOptions)),
    };
}

function addLinkToSubscription(targetDir, data){
    let filePath = path.join(targetDir, "subscriptions.txt");

    if (!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, data);
    }
    else{
        fs.appendFileSync(filePath, `\n${data}`);
    }

    return filePath;
}

/**
 * Throne deep link: throne://add/<url-safe_base64>
 * Payload: outbound JSON (same as Throne ExportJsonLink)
 * @see https://throneproj.github.io/advanced/deeplinks/
 */
function getAddLink(outbound) {
    const base64 = base64url(JSON.stringify(outbound));

    return `throne://add/${base64}`;
}

/**
 * Throne deep link: throne://addsub/<standard_base64>
 * Payload: <subscription_url>[#<group_name>]
 * @see https://throneproj.github.io/advanced/deeplinks/
 */
function getSubscriptionLink(subscriptionUrl, groupName = 'Hungcabinet (Все прокси)') {
    const payload = groupName
        ? `${subscriptionUrl}#${encodeURIComponent(groupName)}`
        : subscriptionUrl;
    const base64 = Buffer.from(payload, 'utf8').toString('base64');

    return `throne://addsub/${base64}`;
}

const ROUTE_PROFILE_NAME = 'Hungcabinet (Маршруты)';

function parseSimpleRuleLines(lines) {
    const fields = {
        domain: [],
        domain_suffix: [],
        domain_keyword: [],
        domain_regex: [],
        rule_set: [],
        ip_cidr: [],
        process_name: [],
        process_path: [],
    };

    for (const line of lines) {
        const colonIdx = line.indexOf(':');

        if (colonIdx < 0) {
            continue;
        }

        const kind = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (!value) {
            continue;
        }

        switch (kind) {
            case 'domain':
                fields.domain.push(value);
                break;
            case 'suffix':
                fields.domain_suffix.push(value);
                break;
            case 'keyword':
                fields.domain_keyword.push(value);
                break;
            case 'regex':
                fields.domain_regex.push(value);
                break;
            case 'ruleset':
                fields.rule_set.push(value);
                break;
            case 'ip':
                fields.ip_cidr.push(value);
                break;
            case 'processName':
                fields.process_name.push(value);
                break;
            case 'processPath':
                fields.process_path.push(value);
                break;
            default:
                break;
        }
    }

    return fields;
}

function pushNonEmptyFields(target, fields, keys) {
    for (const key of keys) {
        if (fields[key]?.length) {
            target[key] = fields[key];
        }
    }

    return Object.keys(target).some((key) => keys.includes(key));
}

function buildSimpleRules(lines, outbound) {
    const fields = parseSimpleRuleLines(lines);
    const isDirect = outbound === 'direct';
    const rules = [];

    const addressRule = {
        name: isDirect ? 'Direct' : 'Proxy',
        type: isDirect ? 'simple_address_bypass' : 'simple_address_proxy',
        action: 'route',
        outbound,
    };

    if (pushNonEmptyFields(addressRule, fields, [
        'domain', 'domain_suffix', 'domain_keyword', 'domain_regex', 'rule_set', 'ip_cidr',
    ])) {
        rules.push(addressRule);
    }

    if (fields.process_name.length) {
        rules.push({
            name: isDirect ? 'Direct processes' : 'Proxy processes',
            type: isDirect ? 'simple_process_name_bypass' : 'simple_process_name_proxy',
            action: 'route',
            outbound,
            process_name: fields.process_name,
        });
    }

    if (fields.process_path.length) {
        rules.push({
            name: isDirect ? 'Direct process paths' : 'Proxy process paths',
            type: isDirect ? 'simple_process_path_bypass' : 'simple_process_path_proxy',
            action: 'route',
            outbound,
            process_path: fields.process_path,
        });
    }

    return rules;
}

/**
 * Throne route profile JSON for throne://route and remote routing files.
 * Built from simple-rule lines (throne.direct.txt / throne.proxy.txt).
 */
function buildRouteProfile(windowsRules, name = ROUTE_PROFILE_NAME) {
    return {
        kind: 'throne-route-profile',
        v: 1,
        name,
        default_outbound: 'proxy',
        rules: [
            ...buildSimpleRules(windowsRules.direct || [], 'direct'),
            ...buildSimpleRules(windowsRules.proxy || [], 'proxy'),
        ],
    };
}

/**
 * Throne deep link: throne://route/<url-safe_base64>
 * @see https://throneproj.github.io/advanced/deeplinks/
 */
function getRouteLink(routeProfile) {
    return `throne://route/${base64url(JSON.stringify(routeProfile))}`;
}

/**
 * Throne deep link: throne://remoteroute/<standard_base64>
 * Payload: newline-separated <profile_url>[#<name>]
 * @see https://throneproj.github.io/advanced/deeplinks/
 */
function getRemoteRouteLink(entries) {
    const payload = entries
        .map(({ url, name }) => (name ? `${url}#${encodeURIComponent(name)}` : url))
        .join('\n');
    const base64 = Buffer.from(payload, 'utf8').toString('base64');

    return `throne://remoteroute/${base64}`;
}

function buildAmneziaOutbound(amneziaData, ctx) {
    let serverName = ctx.serverDisplayName();

    let linkObj = {}

    linkObj["address"] = amneziaData.interface.address;

    if (amneziaData.interface.awg !== undefined){
        linkObj["amnezia_wg"] = {}

        linkObj["amnezia_wg"]["jc"] = amneziaData.interface.awg.Jc;
        linkObj["amnezia_wg"]["jmin"] = amneziaData.interface.awg.Jmin;
        linkObj["amnezia_wg"]["jmax"] = amneziaData.interface.awg.Jmax;

        linkObj["amnezia_wg"]["s1"] = amneziaData.interface.awg.S1;
        linkObj["amnezia_wg"]["s2"] = amneziaData.interface.awg.S2;

        if (amneziaData.interface.awg.S3 !== undefined){
            linkObj["amnezia_wg"]["s3"] = amneziaData.interface.awg.S3;
        }

        if (amneziaData.interface.awg.S4 !== undefined){
            linkObj["amnezia_wg"]["s4"] = amneziaData.interface.awg.S4;
        }

        linkObj["amnezia_wg"]["h1"] = amneziaData.interface.awg.H1;
        linkObj["amnezia_wg"]["h2"] = amneziaData.interface.awg.H2;
        linkObj["amnezia_wg"]["h3"] = amneziaData.interface.awg.H3;
        linkObj["amnezia_wg"]["h4"] = amneziaData.interface.awg.H4;

        if (amneziaData.interface.awg.I1 !== undefined){
            linkObj["amnezia_wg"]["i1"] = amneziaData.interface.awg.I1;
        }
        if (amneziaData.interface.awg.I2 !== undefined){
            linkObj["amnezia_wg"]["i2"] = amneziaData.interface.awg.I2;
        }
        if (amneziaData.interface.awg.I3 !== undefined){
            linkObj["amnezia_wg"]["i3"] = amneziaData.interface.awg.I3;
        }
        if (amneziaData.interface.awg.I4 !== undefined){
            linkObj["amnezia_wg"]["i4"] = amneziaData.interface.awg.I4;
        }
        if (amneziaData.interface.awg.I5 !== undefined){
            linkObj["amnezia_wg"]["i5"] = amneziaData.interface.awg.I5;
        }
    }

    if (amneziaData.interface.mtu !== undefined){
        linkObj["mtu"] = amneziaData.interface.mtu;
    }

    linkObj["peers"] = amneziaData.peers.map(peer => {
        const result = {};

        result["address"] = peer.endpointHost;
        result["port"] = peer.endpointPort;
        if (peer.PersistentKeepalive !== undefined){
            result["persistent_keepalive_interval"] = peer.PersistentKeepalive;
        }
        result["public_key"] = peer.PublicKey;
        if (peer.PresharedKey !== undefined){
            result["pre_shared_key"] = peer.PresharedKey;
        }

        return result;
    })

    linkObj["private_key"] = amneziaData.interface.privateKey;
    linkObj["tag"] = `${serverName} [${ctx.protocol}]`;
    linkObj["type"] = "wireguard";

    return linkObj;
}

function addAmneziaSubscription(targetDir, amneziaData, ctx)
{
    const linkObj = buildAmneziaOutbound(amneziaData, ctx);
    let jsonString = JSON.stringify(linkObj, null, 0);
    let base64 = base64url(jsonString);
    let link = `json://throne#${base64}`;

    return { filePath: addLinkToSubscription(targetDir, link), link, outbound: linkObj };
}
export default {
    extractWindowsRoutes,
    addLinkToSubscription,
    addAmneziaSubscription,
    getSubscriptionLink,
    getAddLink,
    buildRouteProfile,
    getRouteLink,
    getRemoteRouteLink,
    ROUTE_PROFILE_NAME,
};
