import fs from 'fs';

const source = {
    layout: 'server-shared',
    pattern: /^naiveproxy.*\.json$/i,
    getUsers(configPath) {
        const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return getForwardProxyRoutes(configData).flatMap(v1 => v1.route.auth_user_deprecated);
    },
};

function findObjects(obj, predicate, result = []) {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            findObjects(item, predicate, result);
        }
    } else if (obj && typeof obj === 'object') {
        if (predicate(obj)) {
            result.push(obj);
        }

        for (const value of Object.values(obj)) {
            findObjects(value, predicate, result);
        }
    }

    return result;
}

function getForwardProxyRoutes(configData){
    let servers = configData.apps?.http?.servers;

    let result = [];

    for (const serversKey in servers) {
        let server = servers[serversKey];

        let port = (server.listen || [undefined])[0]?.split(":")?.at(-1);
        if (port === undefined) {
            continue;
        }

        let routes = findObjects(
            server,
            obj =>
                'handler' in obj &&
                'auth_pass_deprecated' in obj &&
                'auth_user_deprecated' in obj &&
                obj.handler === 'forward_proxy'
        ).map(value => {
            return { port: port, route: value }
        });

        result = [...result, ...routes];
    }

    return result;
}

function getSni(configData){
    return (configData.apps?.tls?.certificates?.automate || [undefined])[0];
}

function getUsers(configPath){
    return source.getUsers(configPath);
}

function toOutbound(configData, endpoint = undefined, userName = undefined, withQuic = false, tag = 'proxy', domainResolver = 'google'){
    const warnings = [];
    const errors = [];

    let userRoute = getForwardProxyRoutes(configData).find(value => value.route.auth_user_deprecated === userName);
    if (userRoute === undefined){
        errors.push(`Пользователь '${userName}' не найден`);
        return { success: false, errors, warnings };
    }

    let sni = getSni(configData);
    if (sni === undefined){
        errors.push(`SNI не найден`);
        return { success: false, errors, warnings };
    }

    if (endpoint === undefined){
        errors.push(`IP эндпоинт не задан`);
        return { success: false, errors, warnings };
    }

    let outbound = {
        type: "naive",
        tag: tag,
        udp_over_tcp: {
            enabled: true,
            version: 2
        },
        server: endpoint,
        server_port: parseInt(userRoute.port),
        tls: {
            server_name: sni,
            enabled: true
        },
        username: userRoute.route.auth_user_deprecated,
        password: userRoute.route.auth_pass_deprecated
    };

    if (domainResolver) {
        outbound.domain_resolver = domainResolver;
    }

    if (withQuic) {
        outbound.quic = true;
        outbound.quic_congestion_control = "bbr2";
    }

    return {
        success: true,
        outbound,
        warnings,
        errors,
        parsed:{
            username: userRoute.route.auth_user_deprecated,
            password: userRoute.route.auth_pass_deprecated,
            endpoint,
            sni,
            port: parseInt(userRoute.port)
        }
    };
}

export default { source, getUsers, toOutbound, getForwardProxyRoutes, getSni };
