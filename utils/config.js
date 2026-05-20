import merge from 'deepmerge';
import fs from 'fs';
import path from 'path';

function getConfigPath(fileRelativePath){
    let configsPath = path.join("./configs", fileRelativePath);

    if (fs.existsSync(configsPath)){
        return configsPath;
    }

    return path.join("./defaultConfigs", fileRelativePath);;
}

function getConfigContent(fileRelativePath){
    return fs.readFileSync(getConfigPath(fileRelativePath), "utf-8");
}

const data = JSON.parse(getConfigContent("config.json"));

function getVpnServerConfig(serverName){
    let defaultConf = data.vpnServers?.default || {
        naiveproxy:{
            useQuic: false
        }};
    let server = data.vpnServers?.servers === undefined ? {} : (data.vpnServers?.servers[serverName] || {});

    return merge(defaultConf, server);
}

function getCommonConfig(){
    let result = {
        sourceDirectoryPath: "./data/src",
        destinationDirectoryPath: "./data/dst"
    }

    let configData = data.files || {};

    return merge(result, configData);
}

function getSocksConfig(){
    let result = {
        ip: '127.0.0.1',
        port: '1080'
    }

    let configData = data.socks || {};

    return merge(result, configData);
}

function getRsyncConfig(){
    let result = {
        "enabled" : false
    }

    let configData = data.rsync || {};

    return merge(result, configData);
}

function getWebServerConfig(){
    let result = {
        "enabled" : false
    }

    let configData = data.webServer || {};

    return merge(result, configData);
}

export default { getVpnServerConfig, getCommonConfig, getRsyncConfig, getWebServerConfig, getConfigPath, getConfigContent, getSocksConfig};