import singBox from "./singBox.js";
import configUtil from "./config.js";
import contextUtil from "./context.js";
import fs from "fs";
import path from "path";
import files from "./files.js";
import webSite from "./webSite.js";

function generateSocksLink(){
    let socksInbound = singBox.getSocksInbound();
    let config = configUtil.getVpnServerConfig(contextUtil.getServer())
    let socks = configUtil.getSocksConfig();

    let ip = socks?.ip || socksInbound.listen;
    let port = socks?.port || socksInbound.listen_port;

    let user = socks?.user;
    let password = socks?.password;

    if ((user === undefined || password === undefined) && socksInbound.users?.length > 0) {
        user = socksInbound.users[0].username;
        password = socksInbound.users[0].password;
    }

    let link = `tg://socks?server=${ip}&port=${port}`
    if (user !== undefined && password !== undefined) {
        link += `&user=${user}&pass=${password}`;
    }

    return link;
}

function generateUserData(userFileData){
    contextUtil.withProtocol("telegram", () => {
        let link = fs.readFileSync(userFileData.path, "utf-8");

        contextUtil.withPlatform("telegram", () => {
            let linkFilePath = path.join(contextUtil.getCommonDir(), `${files.getFileName()}.link`);

            fs.copyFileSync(userFileData.path, linkFilePath);
            webSite.addSpecificLink(link, `[${contextUtil.getProtocol()}] Telegram proxy`, "telegram");
        });
    });
}

export default { generateSocksLink, generateUserData };