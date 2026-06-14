import config from "./config.js";
import merge from "deepmerge";

const singBoxTemplate = config.getConfigContent("singBoxTemplate.json");
const socksInboundTemplate = config.getConfigContent("socksInboundTemplate.json");
const tunInboundTemplate = config.getConfigContent("tunInboundTemplate.json");

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

function getAndroidTemplate(){
    return merge({
        outbounds: [],
        inbounds: [],
        endpoints: []
    },JSON.parse(singBoxTemplate));
}

function getIosTemplate(){
    let result = getAndroidTemplate();

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
