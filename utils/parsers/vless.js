import { URL } from 'url';

const source = {
    layout: 'per-user',
    pattern: /^vless.*\.link$/i,
};

function toOutbound(vlessLink, defaultFingerPrint = "firefox", tag = 'proxy', domainResolver = 'google'){
    const warnings = [];
    const errors = [];

    try {
        let url;
        try {
            let link = vlessLink.replace('vless://', 'https://');
            url = new URL(link);
        } catch (e) {
            errors.push('Неверный формат VLESS ссылки');
            return { success: false, errors, warnings };
        }

        let uuid = url.username;
        let address = url.hostname;
        let port = parseInt(url.port) || 443;

        if (!uuid && url.pathname.includes('@')) {
            const parts = url.pathname.slice(1).split('@');
            uuid = parts[0];
            if (parts[1]) {
                const [addr, p] = parts[1].split(':');
                if (addr) address = addr;
                if (p) port = parseInt(p);
            }
        }

        const params = url.searchParams;
        const remarks = decodeURIComponent(url.hash.slice(1)) || 'VLESS Reality';

        const security = params.get('security') || 'none';
        const type = params.get('type') || 'tcp';
        const flow = params.get('flow') || '';
        let fp = params.get('fp') || 'chrome';
        const sni = params.get('sni') || params.get('servername') || '';
        const pbk = params.get('pbk') || '';
        const sid = params.get('sid') || '';

        if (security !== 'reality' && security !== 'tls' && security !== 'none') {
            warnings.push(`security=${security} — sing-box лучше всего работает с reality или tls`);
        }

        if (flow && flow !== 'xtls-rprx-vision') {
            errors.push(`flow=${flow} не поддерживается в sing-box. Поддерживается только "xtls-rprx-vision" или пустое значение.`);
        }

        if (type !== 'tcp' && type !== 'ws' && type !== 'grpc' && type !== 'http') {
            warnings.push(`type=${type} — sing-box поддерживает tcp, ws, grpc, но Reality лучше всего работает с tcp`);
        }

        const isReality = security === 'reality';
        if (isReality && !pbk) {
            errors.push('Reality включён, но отсутствует параметр pbk (public_key)');
        }

        const validFingerprints = ['safari', 'firefox', 'edge'];
        if (!validFingerprints.includes(fp)) {
            fp = defaultFingerPrint || "firefox";
        }

        const outbound = {
            type: "vless",
            tag: tag,
            server: address,
            server_port: port,
            uuid: uuid,
            flow: flow || undefined,
            packet_encoding: "xudp",
            network: type === 'tcp' ? undefined : type,
        };

        const tls = {
            enabled: true,
            server_name: sni || (isReality ? 'www.microsoft.com' : address),
            utls: {
                enabled: true,
                fingerprint: fp
            }
        };

        if (isReality) {
            tls.reality = {
                enabled: true,
                public_key: pbk,
                short_id: sid || undefined
            };
        }

        outbound.tls = tls;

        if (domainResolver) {
            outbound.domain_resolver = domainResolver;
        }

        if (isReality && flow !== 'xtls-rprx-vision') {
            warnings.push('Reality рекомендуется использовать вместе с flow=xtls-rprx-vision');
        }

        if (type !== 'tcp' && isReality) {
            warnings.push('Reality + WebSocket/gRPC может работать нестабильно в sing-box. Лучше использовать tcp.');
        }

        return {
            success: errors.length === 0,
            outbound,
            warnings,
            errors,
            parsed: {
                uuid, address, port, security, type, flow, fp, sni, pbk, sid, remarks
            }
        };

    } catch (err) {
        errors.push(`Неизвестная ошибка: ${err.message}`);
        return { success: false, errors, warnings };
    }
}

function fixVlessLink(vlessLink, customName = undefined, platform = 'windows'){
    let link = vlessLink.replace('vless://', 'https://');
    let url = new URL(link);

    const params = url.searchParams;

    let fp = params.get('fp') || 'firefox';

    if (platform === "ios"){
        params.set('fp', "safari");
    }
    else{
        const validFingerprints = ['safari', 'firefox', 'edge'];

        if (!validFingerprints.includes(fp)) {
            fp = validFingerprints[Math.floor(Math.random() * validFingerprints.length)];
        }

        params.set('fp', fp);
    }

    if (customName !== undefined){
        url.hash = `#${customName}`;
    }

    link = url.href.replace('https://', 'vless://');

    return link;
}

export default { source, toOutbound, fixVlessLink };
