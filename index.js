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
import contextUtil from "./utils/context.js";

async function mainProcess(){
    webServer.startCollectData();

    let commonConfig = configUtil.getCommonConfig();
    let userFilesData = files.getUserFiles(commonConfig)

    let users = [...new Set(userFilesData.map(data => data.userName))];

    for (const user of users) {
        context.withUserData(user, "common", () => {
            files.prepareContextDirs();
        });
    }

    for(let i = 0; i < userFilesData.length; i++) {
        let data = userFilesData[i];

        context.withUserData(data.userName, data.srvName, () => {
            files.prepareContextDirs();

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

    for (const user of users) {
        let commonServerDest = files.getUserDestinationPath(commonConfig, user, "common");

        context.withUserData(user, "common", () => {

            context.withPlatform("android", ()=>{
                let androidTelegramLink = telegram.generateSocksLink();
                webServer.addSpecificLink(androidTelegramLink, "[TELEGRAM] Локальный socks5 прокси", "telegram")
            });

            let windowsRules = throne.extractWindowsRoutes();

            context.withPlatform("windows", ()=>{

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