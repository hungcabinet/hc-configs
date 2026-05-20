import files from "./files.js";
import path from "path";
import config from "./config.js";

let context = {
}

function withCommon(props, values, callback) {
    let olds = []

    for(let i = 0; i < props.length; i++) {
        olds.push(context[props[i]]);
        context[props[i]] = values[i];
    }

    callback();

    for(let i = 0; i < props.length; i++) {
        context[props[i]] = olds[i];
    }
}

function withUserData(user, server, callback) {
    withCommon(["user", "server"], [user, server], callback);
}

function withProtocol(protocol, callback) {
    withCommon(["protocol"], [protocol], callback);
}

function withPlatform(platform, callback) {
    withCommon(["platform"], [platform], callback);
}

function getUser(){
    return context.user;
}

function getServer(){
    return context.server;
}

function getDir(platform){
    return path.join(files.getUserDestinationPath(config.getCommonConfig(), getUser(), getServer()), platform);
}

function getCommonDir(){
    return getDir("common");
}

function getWinDir(){
    return getDir("windows");
}

function getAndroidDir(){
    return getDir("android");
}

function getIosDir(){
    return getDir("ios");
}

function getRawDir(){
    return getDir("raw");
}

function getProtocol(){
    return context.protocol || "common";
}

function getPlatform(){
    return context.platform || "unknown";
}

export default {
    withUserData,
    withProtocol,
    withPlatform,
    getUser,
    getServer,
    getCommonDir,
    getWinDir,
    getAndroidDir,
    getIosDir,
    getRawDir,
    getProtocol,
    getPlatform
};