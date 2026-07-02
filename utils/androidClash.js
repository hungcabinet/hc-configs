import webSite from './webSite.js';
import mihomo from './mihomo.js';
import files from './files.js';

function processAndroidClashConfig(ctx, mihomoConfig) {
    const androidCtx = ctx.withPlatform('android-clash');
    const androidDir = androidCtx.dir();
    const filePath = files.saveYamlObject(androidCtx, mihomoConfig, androidDir, 'tun');
    const link = webSite.addUserFileLink(
        androidCtx,
        filePath,
        `[${ctx.displayProtocol()}][TUN] конфиг для Clash`,
        'config',
        ['download', 'copy-data']
    );

    webSite.addSpecificLink(
        androidCtx,
        mihomo.getSubscriptionLink(androidCtx, link, 'tun'),
        `[${ctx.displayProtocol()}][TUN] подписка для Clash`,
        'subscription'
    );
}

function processIosMihomoConfig(ctx, mihomoConfig) {
    const iosCtx = ctx.withPlatform('ios');
    const filePath = files.saveYamlObject(iosCtx, mihomoConfig, iosCtx.dir(), 'tun');

    webSite.addUserFileLink(
        iosCtx,
        filePath,
        `[${ctx.displayProtocol()}][TUN] конфиг для Clash`,
        'config',
        ['download', 'copy-link']
    );
}

export default { processAndroidClashConfig, processIosMihomoConfig };
