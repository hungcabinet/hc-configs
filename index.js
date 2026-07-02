import fs from 'fs';
import path from 'path';
import config from "./utils/config.js";
import rsync from "./utils/rsync.js";
import sshAuth from "./utils/sshAuth.js";
import files from "./utils/files.js";
import webServer from "./utils/webSite.js";
import { createContext } from "./utils/generationContext.js";
import throne from "./utils/throne.js";
import telegram from "./utils/telegram.js";
import protocolRegistry from "./utils/protocolRegistry.js";
import report from "./utils/report.js";
import mihomoProxies from "./utils/mihomoProxies.js";

async function mainProcess(){
    report.reset();
    mihomoProxies.reset();

    let commonConfig = config.getCommonConfig();
    let userFilesData = files.getUserFiles(commonConfig)

    let users = [...new Set(userFilesData.map(data => data.userName))];

    for (const user of users) {
        const ctx = createContext(user, "common");
        files.prepareContextDirs(ctx);
    }

    for(let i = 0; i < userFilesData.length; i++) {
        let data = userFilesData[i];
        const ctx = createContext(data.userName, data.srvName);

        files.prepareContextDirs(ctx);

        for(let j = 0; j < data.files.length; j++) {
            let file = data.files[j];
            let handler = protocolRegistry.findHandler(file.name);

            if (handler !== undefined) {
                handler.generate(ctx.withProfile(handler.getProfileId(file.name)), file);
            } else {
                report.warn('unknown', file.path, `Неизвестный тип файла: ${file.name}`);
            }
        }

        mihomoProxies.flushAll(data.userName, data.srvName);
    }

    for (const user of users) {
        const commonCtx = createContext(user, "common");
        const commonServerDest = files.getUserDestinationPath(commonConfig, user, "common");

        const androidCtx = commonCtx.withPlatform("android");
        webServer.addSpecificLink(
            androidCtx,
            telegram.generateSocksLink(),
            "[TELEGRAM] Локальный socks5 прокси",
            "telegram"
        );

        let windowsRules = throne.extractWindowsRoutes(commonCtx);
        const windowsCtx = commonCtx.withPlatform("windows");

        let directRulesPath = path.join(commonServerDest, "windows", "direct-rules.txt");
        let proxyRulesPath = path.join(commonServerDest, "windows", "proxy-rules.txt");

        fs.writeFileSync(directRulesPath, windowsRules.direct.join("\n").trim());
        fs.writeFileSync(proxyRulesPath, windowsRules.proxy.join("\n").trim());

        webServer.addUserFileLink(windowsCtx, directRulesPath, "Direct правила маршрутизации", "routing", ["download", "copy-data"]);
        webServer.addUserFileLink(windowsCtx, proxyRulesPath, "Proxy правила маршрутизации", "routing", ["download", "copy-data"]);

        await webServer.renderUserIndex(user);
    }

    webServer.writeWebFiles();

    await syncGeneratedData(commonConfig);
    await updateRemoteAuth();

    report.printSummary();

    if (report.hasErrors()) {
        process.exit(1);
    }
}

async function syncGeneratedData(commonConfig){

    let rsyncConfig = config.getRsyncConfig();

    if (!rsyncConfig.enabled){
        return;
    }

    await rsync.syncDstFiles(path.resolve(commonConfig.destinationDirectoryPath), rsyncConfig);
}

async function updateRemoteAuth() {
    let webServerConfig = config.getWebServerConfig();

    await sshAuth.updateRemoteUsers(webServerConfig);
}

mainProcess().catch(error => {
    if (error.code === 'CONFIG_NOT_FOUND' || error.code === 'CONFIG_INVALID' || error.code === 'CONFIG_INVALID_JSON' || error.code === 'CONFIG_READ_ERROR') {
        console.error(error.message);
    } else {
        console.error(error);
    }

    process.exit(1);
});
