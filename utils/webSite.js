import Twig from 'twig';
import fs from "fs";
import config from "./config.js";
import files from "./files.js";
import contextUtil from "./context.js";
import configUtil from "./config.js";
import path from "path";

let webServerData = {
    users: {}
}
const webConfig = config.getWebServerConfig();

const linkTypePriority = [
    'telegram',
    'subscription',
    'config',
    'routing',
    'link',
    'outbound',
    'inbound'
];

const platformPriority = [
    "telegram",
    "android",
    "windows",
    "ios",
    "raw"
]

const linkTypePriorityMap = new Map(
    linkTypePriority.map((type, index) => [type, index])
);

const platformPriorityMap = new Map(
    platformPriority.map((type, index) => [type, index])
);

const renderTemplate = (filePath, context) => {
    return new Promise((resolve, reject) => {
        Twig.renderFile(filePath, context, (err, html) => {
            if (err) return reject(err);
            resolve(html);
        });
    });
};

function startCollectData(){
    webServerData = {
        users: {}
    }
}

function getUserData(user){
    let result = webServerData.users[user];

    if (result === undefined){
        result = {
            name: user,
            platforms:[]
        }

        webServerData.users[user] = result;
    }

    return result;
}

function getPlatformName(platform){
    switch(platform){
        case "android":
            return "Android";
        case "ios":
            return "iOS";
        case "windows":
            return "Windows";
        case "telegram":
            return "Telegram Proxies";
        case "raw":
            return "Raw";
        default:
            return platform;
    }
}

function getPlatformData(user, platform){
    let userData = getUserData(user);

    let result = userData.platforms.find(p => p.id === platform);

    if (result === undefined){
        result = {
            id: platform,
            name: getPlatformName(platform),
            servers: []
        }

        userData.platforms.push(result);
    }

    return result;
}

function getServerData(user, platform, server){
    let platformData = getPlatformData(user, platform);

    let result = platformData.servers.find(s => s.id === server);

    if (result === undefined) {
        let serverConfig = config.getVpnServerConfig(server);

        result = {
            id: server,
            name: serverConfig?.name || server,
            links: []
        }

        platformData.servers.push(result);
    }

    return result;
}

function addUserFileLink(filePath, text, linkType = "common", attributes= ["open"]){
    if (!webConfig.enabled){
        return;
    }

    let baseUrl = webConfig.baseUrl;
    let url = new URL(baseUrl);

    let relative = files.getRelativeDestinationFilePath(filePath, contextUtil.getUser());

    url.pathname = `/${relative}`;

    return addUserSimpleLink(url.href, text, linkType, attributes);
}

function addUserSimpleLink(link, text, linkType = "common", attributes= ["open"]){
    if (!webConfig.enabled){
        return;
    }

    let url = new URL(link);

    let webUser = webConfig.users.find(s => s.userName === contextUtil.getUser());
    if (webUser !== undefined){
        url.username = webUser.userName;
        url.password = webUser.password;
    }

    let serverData = getServerData(contextUtil.getUser(), contextUtil.getPlatform(), contextUtil.getServer());

    if (!serverData.links.some(v => v.href === url.href && v.text === text && v.linkType === linkType)){
        serverData.links.push({
            href: url.href,
            download: link,
            text: text,
            linkType: linkType,
            attributes: attributes
        });
    }

    return url.href;
}

function addSpecificLink(link, text, linkType = "common"){
    if (!webConfig.enabled){
        return;
    }

    let serverData = getServerData(contextUtil.getUser(), contextUtil.getPlatform(), contextUtil.getServer());

    if (!serverData.links.some(v => v.href === link && v.text === text && v.linkType === linkType)){
        serverData.links.push({
            href: link,
            download: link,
            text: text,
            linkType: linkType,
            attributes: ["open"]
        });
    }
}

async function renderUserIndex(user){
    if (!webConfig.enabled){
        return;
    }

    let commonConfig = configUtil.getCommonConfig();

    let htmlPath = path.join(commonConfig.destinationDirectoryPath, "users", user, "index.html");
    let siteDstPath = path.join(commonConfig.destinationDirectoryPath, "site");

    let cssSourcePath = configUtil.getConfigPath("site/site.css");
    let jsSourcePath = configUtil.getConfigPath("site/site.js");

    let cssPath = path.join(siteDstPath, "site.css");
    let jsPath = path.join(siteDstPath, "site.js");

    files.prepareDir(siteDstPath);

    let data = getUserData(user);

    data.platforms.sort((a, b) => {
        const aPriority = platformPriorityMap.get(a.id) ?? Infinity;
        const bPriority = platformPriorityMap.get(b.id) ?? Infinity;

        return aPriority - bPriority;
    });

    for (const platform of data.platforms) {

        let commonServerIdx = platform.servers.findIndex(value => value.id === "common");

        if (commonServerIdx >= 0){
            let commonServer = platform.servers[commonServerIdx];
            platform.servers.splice(commonServerIdx, 1);
            platform.servers.unshift(commonServer);
        }

        for (const server of platform.servers) {
            server.links.sort((a, b) => {
                const aPriority = linkTypePriorityMap.get(a.linkType) ?? Infinity;
                const bPriority = linkTypePriorityMap.get(b.linkType) ?? Infinity;

                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }

                return a.text.localeCompare(b.text, 'ru');
            });
        }
    }

    const html = await renderTemplate(configUtil.getConfigPath("webSiteTemplate.twig"), {
        baseUrl: webConfig.baseUrl,
        user: getUserData(user)
    });

    fs.writeFileSync(htmlPath, html);
    fs.copyFileSync(cssSourcePath, cssPath);
    fs.copyFileSync(jsSourcePath, jsPath);
}

export default { startCollectData, addUserFileLink, addUserSimpleLink, renderUserIndex, addSpecificLink};