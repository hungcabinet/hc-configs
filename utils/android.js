import webServer from "./webSite.js";
import singBox from "./singBox.js";
import files from "./files.js";

function processAndroidConfig(ctx, androidConfig, tunInbound, socksInbound) {
    const androidCtx = ctx.withPlatform('android');
    const androidDir = androidCtx.dir();

    androidConfig.inbounds.push(tunInbound);
    let filePath = files.saveJsonObject(androidCtx, androidConfig, androidDir, "tun");
    let link = webServer.addUserFileLink(androidCtx, filePath, `[${ctx.displayProtocol()}][TUN] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(androidCtx, singBox.getSubscriptionLink(androidCtx, link, "tun"), `[${ctx.displayProtocol()}][TUN] подписка для hc-box`, "subscription");

    androidConfig.inbounds.push(socksInbound);
    filePath = files.saveJsonObject(androidCtx, androidConfig, androidDir, "hybrid");
    link = webServer.addUserFileLink(androidCtx, filePath, `[${ctx.displayProtocol()}][TUN+SOCKS] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(androidCtx, singBox.getSubscriptionLink(androidCtx, link, "tun+socks5"), `[${ctx.displayProtocol()}][TUN+SOCKS] подписка для hc-box`, "subscription");

    androidConfig.inbounds.shift();
    filePath = files.saveJsonObject(androidCtx, androidConfig, androidDir, "socks");
    link = webServer.addUserFileLink(androidCtx, filePath, `[${ctx.displayProtocol()}][SOCKS] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(androidCtx, singBox.getSubscriptionLink(androidCtx, link, "socks5"), `[${ctx.displayProtocol()}][SOCKS] подписка для hc-box`, "subscription");
}

export default { processAndroidConfig };
