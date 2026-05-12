import merge from "deepmerge";

let context = {
    dirs:{}
}

function getContextSafe() {
    return merge({}, context);
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

function withUserData(user, server, dirs, callback) {
    withCommon(["user", "server", "dirs"], [user, server, dirs], callback);
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

function getCommonDir(){
    return context.dirs?.commonDir;
}

function getWinDir(){
    return context.dirs?.winDir;
}

function getAndroidDir(){
    return context.dirs?.androidDir;
}

function getIosDir(){
    return context.dirs?.iosDir;
}

function getRawDir(){
    return context.dirs?.rawDir;
}

function getProtocol(){
    return context.protocol || "common";
}

function getProtocolUpper(){
    return getProtocol().toUpperCase();
}

function getPlatform(){
    return context.platform || "unknown";
}

export default {
    withUserData,
    withProtocol,
    withPlatform,
    getContextSafe,
    getUser,
    getServer,
    getCommonDir,
    getWinDir,
    getAndroidDir,
    getIosDir,
    getRawDir,
    getProtocol,
    getProtocolUpper,
    getPlatform
};