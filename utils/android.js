import webServer from "./webSite.js";
import singBox from "./singBox.js";
import files from "./files.js";
import contextUtil from "./context.js";

function processAndroidConfig(androidConfig, tunInbound, socksInbound) {
    let androidDir = contextUtil.getAndroidDir();

    androidConfig.inbounds.push(tunInbound);
    let filePath = files.saveJsonObject(androidConfig, androidDir, "tun");
    let link = webServer.addUserFileLink(filePath, `[${contextUtil.getProtocol()}][TUN] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(singBox.getSubscriptionLink(link, "tun"), `[${contextUtil.getProtocol()}][TUN] подписка для hc-box`, "subscription");

    androidConfig.inbounds.push(socksInbound);
    filePath = files.saveJsonObject(androidConfig, androidDir,"hybrid");
    link = webServer.addUserFileLink(filePath, `[${contextUtil.getProtocol()}][TUN+SOCKS] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(singBox.getSubscriptionLink(link, "tun+socks5"), `[${contextUtil.getProtocol()}][TUN+SOCKS] подписка для hc-box`, "subscription");

    androidConfig.inbounds.shift();
    filePath = files.saveJsonObject(androidConfig, androidDir, "socks");
    link = webServer.addUserFileLink(filePath, `[${contextUtil.getProtocol()}][SOCKS] конфиг для hc-box`, "config", ["download", "copy-data"]);
    webServer.addSpecificLink(singBox.getSubscriptionLink(link, "socks5"), `[${contextUtil.getProtocol()}][SOCKS] подписка для hc-box`, "subscription");
}

export default { processAndroidConfig };