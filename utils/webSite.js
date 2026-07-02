import Twig from 'twig';
import fs from "fs";
import config from "./config.js";
import files from "./files.js";
import path from "path";
import meta from "./meta.js";
import urlAuth from "./urlAuth.js";

let webServerData = {
    users: {}
}
let devRun = false;
const webConfig = config.getWebServerConfig();

function setDevRun(value) {
    devRun = value;
}

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
    "android-clash",
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
            return "Android (hc-box)";
        case "android-clash":
            return "Android (Clash Mi)";
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

function addUserFileLink(ctx, filePath, text, linkType = "common", attributes= ["open"]){
    if (!webConfig.enabled){
        return;
    }

    let baseUrl = webConfig.baseUrl;
    let url = new URL(baseUrl);

    let relative = files.getRelativeDestinationFilePath(filePath, ctx.user);

    url.pathname = `/${relative}`;

    return addUserSimpleLink(ctx, url.href, text, linkType, attributes, filePath);
}

function addUserSimpleLink(ctx, link, text, linkType = "common", attributes= ["open"], downloadLink = link){
    if (!webConfig.enabled){
        return;
    }

    let webUser = webConfig.users.find(s => s.userName === ctx.user);
    let href = urlAuth.embedBasicAuthInLink(
        link,
        webConfig.baseUrl,
        webUser?.userName,
        webUser?.password
    );

    let serverData = getServerData(ctx.user, ctx.platform, ctx.server);

    if (!serverData.links.some(v => v.href === href && v.text === text && v.linkType === linkType)){
        serverData.links.push({
            href: href,
            download: downloadLink,
            text: text,
            linkType: linkType,
            attributes: attributes,
            path: new URL(href).pathname,
        });
    }

    return href;
}

function addSpecificLink(ctx, link, text, linkType = "common"){
    if (!webConfig.enabled){
        return;
    }

    let serverData = getServerData(ctx.user, ctx.platform, ctx.server);

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

    let commonConfig = config.getCommonConfig();

    let htmlPath = path.join(commonConfig.destinationDirectoryPath, "users", user, "index.html");

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

    let metaData = await meta.refreshMeta(user);

    const siteDir = path.join(commonConfig.destinationDirectoryPath, "site");
    const htmlDir = path.dirname(htmlPath);

    let siteCssPath;
    let siteJsPath;

    if (devRun) {
        siteCssPath = path.relative(htmlDir, path.join(siteDir, "site.css")).replace(/\\/g, '/');
        siteJsPath = path.relative(htmlDir, path.join(siteDir, "site.js")).replace(/\\/g, '/');
    } else {
        siteCssPath = `${webConfig.baseUrl}/site/site.css`;
        siteJsPath = `${webConfig.baseUrl}/site/site.js`;
    }

    const html = await renderTemplate(config.getConfigPath("webSiteTemplate.twig"), {
        baseUrl: webConfig.baseUrl,
        siteCssPath,
        siteJsPath,
        user: getUserData(user),
        meta: metaData
    });

    fs.writeFileSync(htmlPath, html);
}

function writeWebFiles(){
    let commonConfig = config.getCommonConfig();

    let siteDstPath = path.join(commonConfig.destinationDirectoryPath, "site");
    let docsDstPath = path.join(commonConfig.destinationDirectoryPath, "docs");

    files.prepareDir(siteDstPath);
    files.prepareDir(docsDstPath);

    let cssSourcePath = config.getConfigPath("site/site.css");
    let jsSourcePath = config.getConfigPath("site/site.js");

    let usersManualSourcePath = config.getConfigPath("docs/for-users.pdf");
    let adminsManualSourcePath = config.getConfigPath("docs/for-admins.pdf");

    let cssPath = path.join(siteDstPath, "site.css");
    let jsPath = path.join(siteDstPath, "site.js");
    let usersManualPath = path.join(docsDstPath, "for-users.pdf");
    let adminsManualPath = path.join(docsDstPath, "for-admins.pdf");

    fs.copyFileSync(cssSourcePath, cssPath);
    fs.copyFileSync(jsSourcePath, jsPath);
    fs.copyFileSync(usersManualSourcePath, usersManualPath);
    fs.copyFileSync(adminsManualSourcePath, adminsManualPath);
}

export default { startCollectData, addUserFileLink, renderUserIndex, addSpecificLink, writeWebFiles, setDevRun};