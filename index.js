import fs from 'fs';
import path from 'path';
import awg from './utils/awg.js';
import vless from './utils/vless.js';
import files from "./utils/files.js";
import configUtil from "./utils/config.js";
import rsync from "./utils/rsync.js";
import config from "./utils/config.js";
import webServer from "./utils/webSite.js";
import context from "./utils/context.js";
import throne from "./utils/throne.js";
import telegram from "./utils/telegram.js";

async function mainProcess(){
    webServer.startCollectData();

    let commonConfig = configUtil.getCommonConfig();
    let userFilesData = files.getUserFiles(commonConfig)

    for(let i = 0; i < userFilesData.length; i++) {
        let data = userFilesData[i];

        let commonDir = path.join(data.dstDir, "common");
        let winDir = path.join(data.dstDir, "windows");
        let androidDir = path.join(data.dstDir, "android");
        let iosDir = path.join(data.dstDir, "ios");
        let rawDir = path.join(data.dstDir, "raw");

        files.prepareDir(commonDir);
        files.prepareDir(winDir);
        files.prepareDir(androidDir);
        files.prepareDir(iosDir);
        files.prepareDir(rawDir);

        context.withUserData(data.userName, data.srvName, { commonDir, winDir, androidDir, iosDir, rawDir }, () => {

            context.withPlatform("android", ()=>{
                let androidTelegramLink = telegram.generateSocksLink();
                webServer.addSpecificLink(androidTelegramLink, "[TELEGRAM] Локальный socks5 прокси", "telegram")
            });

            for(let i = 0; i < data.files.length; i++) {
                let file = data.files[i];

                if (/^vless.*\.link$/i.test(file.name)) {
                    vless.generateUserData(file);

                } else if (/^awg.*\.conf$/i.test(file.name)) {
                    awg.generateUserData(file);

                } else if (/^telegram.*\.link$/i.test(file.name)) {
                    telegram.generateUserData(file);
                }
            }
        });
    }

    let users = [...new Set(userFilesData.map(data => data.userName))];

    for (const user of users) {
        let commonServerDest = files.getUserDestinationPath(commonConfig, user, "common");

        let commonDir = path.join(commonServerDest, "common");
        let winDir = path.join(commonServerDest, "windows");
        let androidDir = path.join(commonServerDest, "android");
        let iosDir = path.join(commonServerDest, "ios");
        let rawDir = path.join(commonServerDest, "raw");

        context.withUserData(user, "common", { commonDir, winDir, androidDir, iosDir, rawDir }, () => {
            let windowsRules = throne.extractWindowsRoutes();

            context.withPlatform("windows", ()=>{
                files.prepareDir(path.join(commonServerDest, "windows"));

                let directRulesPath = path.join(commonServerDest, "windows", "direct-rules.txt");
                let proxyRulesPath = path.join(commonServerDest, "windows", "proxy-rules.txt");

                fs.writeFileSync(directRulesPath, windowsRules.direct.join("\n").trim());
                fs.writeFileSync(proxyRulesPath, windowsRules.proxy.join("\n").trim());

                webServer.addUserFileLink(directRulesPath, "Direct правила маршрутизации", "routing", ["download", "copy-data"]);
                webServer.addUserFileLink(proxyRulesPath, "Proxy правила маршрутизации", "routing", ["download", "copy-data"]);
            });
        });

        await webServer.renderUserIndex(user);
    }

    await syncGeneratedData(commonConfig);
}

async function syncGeneratedData(commonConfig){

    let rsyncConfig = config.getRsyncConfig();

    if (!rsyncConfig.enabled){
        return;
    }

    await rsync.syncDstFiles(path.resolve(commonConfig.destinationDirectoryPath), rsyncConfig);
}

mainProcess().catch(error => {
    console.error(error);
});