import contextUtil from "./context.js";
import config from "./config.js";
import merge from "deepmerge";
import configUtil from "./config.js";

const singBoxTemplate = configUtil.getConfigContent("singBoxTemplate.json");
const socksInboundTemplate = configUtil.getConfigContent("socksInboundTemplate.json");
const tunInboundTemplate = configUtil.getConfigContent("tunInboundTemplate.json");

function getSocksInbound(){
    let inbound = JSON.parse(socksInboundTemplate);

    let socks = configUtil.getSocksConfig();

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

function getSubscriptionLink(originalLink, type){
    let encodedLink = encodeURIComponent(originalLink);

    let server = contextUtil.getServer();
    let serverName = config.getVpnServerConfig(server).name || server;

    let connectionName = encodeURIComponent(`${serverName} [${contextUtil.getProtocol()} ${type}]`)

    return `sing-box://import-remote-profile?url=${encodedLink}#${connectionName}`;
}

export default { getSocksInbound, getTunInbound, getAndroidTemplate, getIosTemplate, getSubscriptionLink};