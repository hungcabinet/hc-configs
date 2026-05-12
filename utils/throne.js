import singBox from "./singBox.js";
import contextUtil from "./context.js";
import fs from "fs";
import path from "path";
import config from "./config.js";
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

function addToSubscription(targetDir, data){
    let filePath = path.join(targetDir, "subscriptions.txt");

    if (!fs.existsSync(filePath)){
        fs.writeFileSync(filePath, data);
    }
    else{
        fs.appendFileSync(filePath, `\n${data}`);
    }

    return filePath;
}

function addVlessSubscription(targetDir, vlessLink){
    return addToSubscription(targetDir, vlessLink);
}

function addAmneziaSubscription(targetDir, amneziaConfig, ip, port){
    let server = contextUtil.getServer();
    let serverName = config.getVpnServerConfig(server).name || server;

    let cleanConfig = amneziaConfig
        .replace(/\uFEFF/g, '')
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    let subscriptionData = {
        extra_core_args: "-c %s",
        extra_core_conf: cleanConfig,
        extra_core_path: "../custom-cores/awg-proxy/wireproxy.exe",
        name: `${serverName} [AWG]`,
        no_logs: false,
        socks_address: ip,
        socks_port: port,
        type: "extracore"
    }

    let jsonString = JSON.stringify(subscriptionData, null, 0);
    let base64 = base64url(jsonString);
    let link = `json://throne#${base64}`;

    return addToSubscription(targetDir, link);
}
export default { extractWindowsRoutes, addVlessSubscription, addAmneziaSubscription };