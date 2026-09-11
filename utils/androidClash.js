import webSite from './webSite.js';
import mihomo from './mihomo.js';
import files from './files.js';

const ALL_CONFIG_LABEL = 'Все протоколы [TUN] конфиг для Clash';
const ALL_SUBSCRIPTION_LABEL = 'Все протоколы [TUN] подписка для Clash';

function processClashSubscriptionConfig(ctx, mihomoConfig, platform, options = {}) {
    const platformCtx = ctx.withPlatform(platform);
    const fileSuffix = options.fileSuffix || 'tun';
    const configLabel = options.configLabel || `[${ctx.displayProtocol()}][TUN] конфиг для Clash`;
    const subscriptionLabel = options.subscriptionLabel || `[${ctx.displayProtocol()}][TUN] подписка для Clash`;
    const subscriptionName = options.subscriptionName;

    const filePath = files.saveYamlObject(platformCtx, mihomoConfig, platformCtx.dir(), fileSuffix);
    const link = webSite.addUserFileLink(
        platformCtx,
        filePath,
        configLabel,
        'config',
        ['download', 'copy-data']
    );

    webSite.addSpecificLink(
        platformCtx,
        mihomo.getSubscriptionLink(platformCtx, link, 'tun', subscriptionName),
        subscriptionLabel,
        'subscription'
    );
}

function processAndroidClashConfig(ctx, mihomoConfig) {
    processClashSubscriptionConfig(ctx, mihomoConfig, 'android-clash');
}

function processWindowsClashConfig(ctx, mihomoConfig) {
    processClashSubscriptionConfig(ctx, mihomoConfig, 'windows-clash');
}

function processIosMihomoConfig(ctx, mihomoConfig, options = {}) {
    const iosCtx = ctx.withPlatform('ios');
    const fileSuffix = options.fileSuffix || 'tun';
    const configLabel = options.configLabel || `[${ctx.displayProtocol()}][TUN] конфиг для Clash`;
    const filePath = files.saveYamlObject(iosCtx, mihomoConfig, iosCtx.dir(), fileSuffix);

    webSite.addUserFileLink(
        iosCtx,
        filePath,
        configLabel,
        'config',
        ['download', 'copy-link']
    );
}

function processAllProxiesClashConfigs(ctx, mihomoConfigByPlatform) {
    const subscriptionName = `${ctx.serverDisplayName()} [all tun]`;
    const sharedOptions = {
        fileSuffix: 'all-tun',
        configLabel: ALL_CONFIG_LABEL,
        subscriptionLabel: ALL_SUBSCRIPTION_LABEL,
        subscriptionName,
    };

    if (mihomoConfigByPlatform['android-clash']) {
        processClashSubscriptionConfig(
            ctx,
            mihomoConfigByPlatform['android-clash'],
            'android-clash',
            sharedOptions
        );
    }

    if (mihomoConfigByPlatform['windows-clash']) {
        processClashSubscriptionConfig(
            ctx,
            mihomoConfigByPlatform['windows-clash'],
            'windows-clash',
            sharedOptions
        );
    }

    if (mihomoConfigByPlatform.ios) {
        processIosMihomoConfig(ctx, mihomoConfigByPlatform.ios, {
            fileSuffix: sharedOptions.fileSuffix,
            configLabel: sharedOptions.configLabel,
        });
    }
}

export default {
    processAndroidClashConfig,
    processWindowsClashConfig,
    processIosMihomoConfig,
    processAllProxiesClashConfigs,
};
