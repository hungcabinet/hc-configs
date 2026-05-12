import fs from 'fs';
import path from 'path';
import config from './config.js';
import contextUtil from "./context.js";
import configUtil from "./config.js";

function getRelativeDestinationFilePath(filePath, userName = undefined) {
    let fullPath = path.resolve(filePath);
    let destinationDirPath = path.resolve(config.getCommonConfig().destinationDirectoryPath);

    if (userName !== undefined) {
        destinationDirPath = path.join(destinationDirPath, "users", userName);
    }

    return path.relative(destinationDirPath, fullPath);
}

function getUserSourcePath(config, userName, srvName) {
    return path.join(config.sourceDirectoryPath, srvName, userName);
}

function getUserDestinationPath(config, userName, srvName) {
    return path.join(config.destinationDirectoryPath, "users", userName, srvName);
}

function getUserFiles(config) {

    const result = [];

    const srvDirs = fs.readdirSync(config.sourceDirectoryPath, { withFileTypes: true });

    for (const srvDir of srvDirs) {

        if (!srvDir.isDirectory()) continue;

        const srvName = srvDir.name;

        const srvPath = path.join(config.sourceDirectoryPath, srvName);

        const userDirs = fs.readdirSync(srvPath, { withFileTypes: true });

        for (const userDir of userDirs) {

            if (!userDir.isDirectory()) continue;

            const userName = userDir.name;

            const srcDir = getUserSourcePath(config, userName, srvName);
            const dstDir = getUserDestinationPath(config, userName, srvName);

            // создаём dst директорию
            fs.mkdirSync(dstDir, { recursive: true });

            const entries = fs.readdirSync(srcDir, { withFileTypes: true });

            const files = [];

            for (const entry of entries) {

                if (!entry.isFile()) continue;

                const ext = path.extname(entry.name).toLowerCase();

                if (ext !== '.conf' && ext !== '.link') continue;

                const fullPath = path.join(srcDir, entry.name);

                files.push({
                    name: entry.name,
                    path: fullPath,
                    ext: ext
                });

            }

            result.push({
                srvName: srvName,
                userName: userName,
                srcDir: srcDir,
                dstDir: dstDir,
                files: files
            });

        }
    }

    return result;
}

function getFileName(suffix = contextUtil.getProtocol()) {
    return `${contextUtil.getServer()}-${contextUtil.getUser()}-${suffix}`;
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

function saveJsonObject(jObject, targetDir, type){
    let filePath = path.join(targetDir, `${getFileName(`${contextUtil.getProtocol()}-${type}`)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(jObject, null, 2));

    return filePath;
}

export default { getUserFiles, getFileName, prepareDir, saveJsonObject, getRelativeDestinationFilePath, getUserSourcePath, getUserDestinationPath };