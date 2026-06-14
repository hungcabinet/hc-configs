import singBox from "./singBox.js";
import fs from "fs";
import path from "path";
import base64url from "base64url";

function extractWindowsRoutes(){
    function sortList(list){
        const order = {
            "ip:": 0,
            "domain:": 1,
            "ruleset:": 2,
        };

        list.sort((a, b) => {
            const getPriority = (str) => {
                const prefix = Object.keys(order).find(p => str.startsWith(p));
                return prefix !== undefined ? order[prefix] : 999;
            };

            return getPriority(a) - getPriority(b);
        });
    }

    let proxyRoutes = [];
    let directRoutes = [];

    let source = singBox.getAndroidTemplate();

    let routeRules = source.route?.rules;
    let rulesets = source.route?.rule_set;

    if (routeRules !== undefined){
        for (const rule of routeRules) {
            if (!("outbound" in rule)){
                continue;
            }

            if (rule.action !== "route"){
                continue;
            }

            let target = undefined;

            switch (rule.outbound) {
                case "proxy":
                    target = proxyRoutes;
                    break;
                case "direct":
                    target = directRoutes;
                    break;
                default:
                    continue;
            }

            for (const key in rule) {
                switch (key){
                    case "rule_set":
                    {
                        if (rulesets === undefined) {
                            break;
                        }

                        let ruleSetTags = rule[key];

                        for (let ruleSetTag of ruleSetTags) {
                            let rulesetUrl = rulesets.find(ruleset => ruleset.tag === ruleSetTag)?.url;

                            if (rulesetUrl !== undefined) {
                                target.push(`ruleset:${rulesetUrl}`);
                            }
                        }
                    }
                        break;
                    case "domain":
                    {
                        let domains = rule[key];

                        for (const domain of domains) {
                            target.push(`domain:${domain}`);
                        }
                    }
                        break;
                    case "ip_cidr":
                    {
                        let ipCidrs = rule[key];

                        for (const ipCidr of ipCidrs) {
                            target.push(`ip:${ipCidr}`);
                        }
                    }
                }
            }
        }
    }

    sortList(proxyRoutes);
    sortList(directRoutes);

    return {
        "proxy": proxyRoutes,
        "direct": directRoutes
    }
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

function addAmneziaSubscription(targetDir, amneziaData, ctx)
{
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

    let jsonString = JSON.stringify(linkObj, null, 0);
    let base64 = base64url(jsonString);
    let link = `json://throne#${base64}`;

    return { filePath: addLinkToSubscription(targetDir, link), link };
}
export default { extractWindowsRoutes, addLinkToSubscription, addAmneziaSubscription };