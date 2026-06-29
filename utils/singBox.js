import config from "./config.js";
import merge from "deepmerge";
import routingData from "./routingData.js";

const SING_BOX_TEMPLATE_FILE = 'template.sing-box.json';
const SOCKS_INBOUND_TEMPLATE_FILE = 'inbound.socks.sing-box.json';
const TUN_INBOUND_TEMPLATE_FILE = 'inbound.tun.sing-box.json';
const singBoxTemplate = config.getConfigContent(SING_BOX_TEMPLATE_FILE);
const socksInboundTemplate = config.getConfigContent(SOCKS_INBOUND_TEMPLATE_FILE);
const tunInboundTemplate = config.getConfigContent(TUN_INBOUND_TEMPLATE_FILE);

function getSocksInbound(){
    let inbound = JSON.parse(socksInboundTemplate);

    let socks = config.getSocksConfig();

    if (socks === undefined) {
        return inbound;
    }

    if (socks.ip !== undefined) {
        inbound.listen = socks.ip;
    }

    if (socks.port !== undefined) {
        inbound.listen_port = socks.port;
    }

    if (socks.user !== undefined && socks.password !== undefined) {
        inbound.users = [
            {
                username: socks.user,
                password: socks.password,
            }
        ];
    }
    else{
        delete inbound.users;
    }

    return inbound;
}

function getTunInbound(endpointHosts){
    let result = JSON.parse(tunInboundTemplate)

    endpointHosts.forEach(endpoint => {result.route_exclude_address.push(endpoint)});

    return result
}

function getAndroidTemplate(ctx){
    const base = JSON.parse(singBoxTemplate);
    const authOptions = routingData.getAuthOptionsForUser(ctx?.user);
    const routing = routingData.buildSingBoxRouting(routingData.loadRoutingData(), authOptions);

    return merge({
        outbounds: [],
        inbounds: [],
        endpoints: []
    }, merge(base, routing));
}

function getIosTemplate(ctx){
    let result = getAndroidTemplate(ctx);

    let dnsRules = result.dns?.rules;

    if (dnsRules !== undefined){
        result.dns.rules = dnsRules.filter(item => !("package_name" in item) && !("package_name_regex" in item));
    }

    let routeRules = result.route?.rules;

    if (routeRules !== undefined){
        result.route.rules = routeRules.filter(item => !("package_name" in item) && !("package_name_regex" in item));
    }

    return result;
}

function getSubscriptionLink(ctx, originalLink, type){
    let encodedLink = encodeURIComponent(originalLink);

    let connectionName = encodeURIComponent(`${ctx.serverDisplayName()} [${ctx.protocol} ${type}]`)

    return `sing-box://import-remote-profile?url=${encodedLink}#${connectionName}`;
}

export default { getSocksInbound, getTunInbound, getAndroidTemplate, getIosTemplate, getSubscriptionLink};
