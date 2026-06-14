import path from 'path';
import config from './config.js';
import files from './files.js';

export class GenerationContext {
    constructor({ user, server, protocol = 'common', platform = 'unknown', profileId = undefined }) {
        this.user = user;
        this.server = server;
        this.protocol = protocol;
        this.platform = platform;
        this.profileId = profileId;
    }

    withProfile(profileId) {
        return new GenerationContext({
            user: this.user,
            server: this.server,
            protocol: this.protocol,
            platform: this.platform,
            profileId,
        });
    }

    withProtocol(protocol) {
        return new GenerationContext({
            user: this.user,
            server: this.server,
            protocol,
            platform: this.platform,
            profileId: this.profileId,
        });
    }

    withPlatform(platform) {
        return new GenerationContext({
            user: this.user,
            server: this.server,
            protocol: this.protocol,
            platform,
            profileId: this.profileId,
        });
    }

    forCommon() {
        return new GenerationContext({
            user: this.user,
            server: 'common',
            protocol: this.protocol,
            platform: this.platform,
            profileId: this.profileId,
        });
    }

    displayProtocol() {
        return this.protocol ?? this.profileId;
    }

    dir(platform = this.platform) {
        return path.join(
            files.getUserDestinationPath(config.getCommonConfig(), this.user, this.server),
            platform
        );
    }

    serverDisplayName() {
        return config.getVpnServerConfig(this.server).name || this.server;
    }

    getUser() {
        return this.user;
    }

    getServer() {
        return this.server;
    }

    getProtocol() {
        return this.protocol;
    }

    getPlatform() {
        return this.platform;
    }

    getCommonDir() {
        return this.dir('common');
    }

    getWinDir() {
        return this.dir('windows');
    }

    getAndroidDir() {
        return this.dir('android');
    }

    getIosDir() {
        return this.dir('ios');
    }

    getRawDir() {
        return this.dir('raw');
    }
}

export function createContext(user, server, protocol = 'common', platform = 'unknown') {
    return new GenerationContext({ user, server, protocol, platform });
}