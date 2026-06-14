import fs from 'fs';
import path from 'path';
import config from './config.js';
import protocolRegistry from './protocolRegistry.js';

function getRelativeDestinationFilePath(filePath, userName = undefined) {
    let fullPath = path.resolve(filePath);
    let destinationDirPath = path.resolve(config.getCommonConfig().destinationDirectoryPath);

    if (userName !== undefined) {
        destinationDirPath = path.join(destinationDirPath, "users", userName);
    }

    return path.relative(destinationDirPath, fullPath);
}

function getUserSourcePath(configData, userName, srvName) {
    return path.join(configData.sourceDirectoryPath, srvName, userName);
}

function getUserDestinationPath(configData, userName, srvName = undefined) {
    return srvName === undefined
        ? path.join(configData.destinationDirectoryPath, "users", userName)
        : path.join(configData.destinationDirectoryPath, "users", userName, srvName);
}

function toFileEntry(entry, basePath) {
    const fullPath = path.join(basePath, entry.name);

    return {
        name: entry.name,
        path: fullPath,
        ext: path.extname(entry.name).toLowerCase(),
    };
}

function pushUserFilesResult(result, data) {
    let existingData = result.find(value => value.srvName === data.srvName && value.userName === data.userName);

    if (existingData !== undefined) {
        existingData.files = [...existingData.files, ...data.files];
        return;
    }

    result.push(data);
}

function collectPerUserDirectory(configData, srvName, userName) {
    const srcDir = getUserSourcePath(configData, userName, srvName);
    const dstDir = getUserDestinationPath(configData, userName, srvName);

    fs.mkdirSync(dstDir, { recursive: true });

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    const files = entries
        .filter(entry => entry.isFile())
        .map(entry => toFileEntry(entry, srcDir));

    return {
        srvName,
        userName,
        srcDir,
        dstDir,
        files,
    };
}

function collectServerSharedFile(configData, srvName, handler, entry) {
    const fileEntry = toFileEntry(entry, entry.path);
    const users = handler.extractUsers(fileEntry.path);
    const results = [];

    for (const userName of users) {
        const srcDir = getUserSourcePath(configData, userName, srvName);
        const dstDir = getUserDestinationPath(configData, userName, srvName);

        fs.mkdirSync(dstDir, { recursive: true });

        results.push({
            srvName,
            userName,
            srcDir,
            dstDir,
            files: [fileEntry],
        });
    }

    return results;
}

function getUserFiles(configData) {
    const result = [];
    const srvDirs = fs.readdirSync(configData.sourceDirectoryPath, { withFileTypes: true });

    for (const srvDir of srvDirs) {
        if (!srvDir.isDirectory()) continue;

        const srvName = srvDir.name;
        const srvPath = path.join(configData.sourceDirectoryPath, srvName);
        const entities = fs.readdirSync(srvPath, { withFileTypes: true });

        for (const entity of entities) {
            if (entity.isDirectory()) {
                pushUserFilesResult(result, collectPerUserDirectory(configData, srvName, entity.name));
                continue;
            }

            if (!entity.isFile()) continue;

            const handler = protocolRegistry.findHandler(entity.name);

            if (handler?.layout === 'server-shared' && handler.extractUsers) {
                for (const data of collectServerSharedFile(configData, srvName, handler, entity)) {
                    pushUserFilesResult(result, data);
                }
            }
        }
    }

    return result;
}

function resolveFileNameSuffix(ctx, suffix) {
    if (ctx.profileId === undefined) {
        return suffix;
    }

    if (suffix === ctx.protocol) {
        return ctx.profileId;
    }

    if (suffix.startsWith(`${ctx.protocol}-`)) {
        return `${ctx.profileId}${suffix.slice(ctx.protocol.length)}`;
    }

    return suffix;
}

function getFileName(ctx, suffix = ctx.protocol) {
    return `${ctx.server}-${ctx.user}-${resolveFileNameSuffix(ctx, suffix)}`;
}

function prepareDir(dirPath){
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isFile()) {
            fs.unlinkSync(path.join(dirPath, entry.name));
        }
    }
}

function prepareContextDirs(ctx){
    prepareDir(ctx.getCommonDir());
    prepareDir(ctx.getWinDir());
    prepareDir(ctx.getAndroidDir());
    prepareDir(ctx.getIosDir());
    prepareDir(ctx.getRawDir());
}

function saveJsonObject(ctx, jObject, targetDir, type){
    let filePath = path.join(targetDir, `${getFileName(ctx, `${ctx.protocol}-${type}`)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(jObject, null, 2));

    return filePath;
}

export default { getUserFiles, getFileName, prepareContextDirs, prepareDir, saveJsonObject, getRelativeDestinationFilePath, getUserDestinationPath };
