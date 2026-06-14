import merge from 'deepmerge';
import fs from 'fs';
import path from 'path';

const userConfigPath = path.join('./configs', 'config.json');
const sampleConfigPath = path.join('./defaultConfigs', 'config.json.sample');

function getConfigPath(fileRelativePath){
    let configsPath = path.join("./configs", fileRelativePath);

    if (fs.existsSync(configsPath)){
        return configsPath;
    }

    return path.join("./defaultConfigs", fileRelativePath);
}

function getConfigContent(fileRelativePath){
    return fs.readFileSync(getConfigPath(fileRelativePath), "utf-8");
}

function validateConfig(configData) {
    const errors = [];

    const rsync = merge({ enabled: false }, configData.rsync || {});

    if (rsync.enabled) {
        if (!rsync.host) {
            errors.push('rsync.host обязателен при rsync.enabled = true');
        }
        if (!rsync.user) {
            errors.push('rsync.user обязателен при rsync.enabled = true');
        }
        if (!rsync.destination) {
            errors.push('rsync.destination обязателен при rsync.enabled = true');
        }
    }

    const webServer = merge({ enabled: false }, configData.webServer || {});

    if (webServer.enabled) {
        if (!webServer.baseUrl) {
            errors.push('webServer.baseUrl обязателен при webServer.enabled = true');
        } else {
            try {
                new URL(webServer.baseUrl);
            } catch {
                errors.push('webServer.baseUrl должен быть валидным URL');
            }
        }

        if (webServer.users !== undefined && !Array.isArray(webServer.users)) {
            errors.push('webServer.users должен быть массивом');
        }

        const sshAuth = merge({ enabled: false }, webServer.sshAuth || {});
        if (sshAuth.enabled) {
            if (!sshAuth.host) {
                errors.push('webServer.sshAuth.host обязателен при sshAuth.enabled = true');
            }
            if (!sshAuth.user) {
                errors.push('webServer.sshAuth.user обязателен при sshAuth.enabled = true');
            }
            if (!sshAuth.htpasswdPath) {
                errors.push('webServer.sshAuth.htpasswdPath обязателен при sshAuth.enabled = true');
            }
        }
    }

    if (errors.length > 0) {
        const error = new Error(
            `Ошибки в ${userConfigPath}:\n  - ${errors.join('\n  - ')}`
        );
        error.code = 'CONFIG_INVALID';
        throw error;
    }
}

function loadConfig() {
    if (!fs.existsSync(userConfigPath)) {
        const error = new Error(
            `Файл конфигурации не найден: ${userConfigPath}\n` +
            `Создайте его на основе ${sampleConfigPath}`
        );
        error.code = 'CONFIG_NOT_FOUND';
        throw error;
    }

    let raw;

    try {
        raw = fs.readFileSync(userConfigPath, 'utf-8');
    } catch (err) {
        const error = new Error(`Не удалось прочитать ${userConfigPath}: ${err.message}`);
        error.code = 'CONFIG_READ_ERROR';
        throw error;
    }

    let configData;

    try {
        configData = JSON.parse(raw);
    } catch (err) {
        const error = new Error(`Некорректный JSON в ${userConfigPath}: ${err.message}`);
        error.code = 'CONFIG_INVALID_JSON';
        throw error;
    }

    validateConfig(configData);

    return configData;
}

const data = loadConfig();

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

    let configData = getWebServerConfig()?.rsync || {};

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