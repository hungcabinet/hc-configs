import path from 'path';
import config from './config.js';
import files from './files.js';

export class GenerationContext {
    constructor({ user, server, protocol = 'common', platform = 'unknown', profileId = undefined, displayNote = undefined }) {
        this.user = user;
        this.server = server;
        this.protocol = protocol;
        this.platform = platform;
        this.profileId = profileId;
        this.displayNote = displayNote;
    }

    copy(overrides = {}) {
        return new GenerationContext({
            user: this.user,
            server: this.server,
            protocol: this.protocol,
            platform: this.platform,
            profileId: this.profileId,
            displayNote: this.displayNote,
            ...overrides,
        });
    }

    withProfile(profileId) {
        return this.copy({ profileId });
    }

    withProtocol(protocol) {
        return this.copy({ protocol });
    }

    withPlatform(platform) {
        return this.copy({ platform });
    }

    withDisplayNote(displayNote) {
        return this.copy({ displayNote });
    }

    forCommon() {
        return this.copy({ server: 'common', displayNote: undefined });
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

    getAndroidClashDir() {
        return this.dir('android-clash');
    }

    getWindowsClashDir() {
        return this.dir('windows-clash');
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