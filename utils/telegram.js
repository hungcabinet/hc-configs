import singBox from "./singBox.js";
import config from "./config.js";

function generateSocksLink(){
    let socksInbound = singBox.getSocksInbound();
    let socks = config.getSocksConfig();

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

export default { generateSocksLink };
