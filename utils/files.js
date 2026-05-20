import fs from 'fs';
import path from 'path';
import config from './config.js';
import contextUtil from "./context.js";
import naiveproxy from "./naiveproxy.js";

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

    function pushResult(data){
        let existingData = result.find(value => value.srvName === data.srvName && value.userName === data.userName);

        if (existingData !== undefined) {
            existingData.files = [...existingData.files, ...data.files];
            return;
        }

        result.push(data);
    }

    const srvDirs = fs.readdirSync(config.sourceDirectoryPath, { withFileTypes: true });

    for (const srvDir of srvDirs) {

        if (!srvDir.isDirectory()) continue;

        const srvName = srvDir.name;

        const srvPath = path.join(config.sourceDirectoryPath, srvName);

        const userDirs = fs.readdirSync(srvPath, { withFileTypes: true });

        for (const entity of userDirs) {

            if (!entity.isDirectory()){
                if (/^naiveproxy.*\.json$/i.test(entity.name)){

                    const fullPath = path.join(entity.path, entity.name);
                    const ext = path.extname(entity.name).toLowerCase();

                    let users = naiveproxy.getUsers(fullPath);

                    for (const userName of users) {
                        const srcDir = getUserSourcePath(config, userName, srvName);
                        const dstDir = getUserDestinationPath(config, userName, srvName);

                        fs.mkdirSync(dstDir, { recursive: true });

                        pushResult({
                            srvName: srvName,
                            userName: userName,
                            srcDir: srcDir,
                            dstDir: dstDir,
                            files: [{
                                name: entity.name,
                                path: fullPath,
                                ext: ext
                            }]
                        });
                    }
                }
            }
            else{
                const userName = entity.name;

                const srcDir = getUserSourcePath(config, userName, srvName);
                const dstDir = getUserDestinationPath(config, userName, srvName);

                fs.mkdirSync(dstDir, { recursive: true });

                const entries = fs.readdirSync(srcDir, { withFileTypes: true });

                const files = [];

                for (const entry of entries) {

                    if (!entry.isFile()) continue;

                    const ext = path.extname(entry.name).toLowerCase();

                    const fullPath = path.join(srcDir, entry.name);

                    files.push({
                        name: entry.name,
                        path: fullPath,
                        ext: ext
                    });

                }

                pushResult({
                    srvName: srvName,
                    userName: userName,
                    srcDir: srcDir,
                    dstDir: dstDir,
                    files: files
                });
            }
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

function prepareContextDirs(){
    prepareDir(contextUtil.getCommonDir());
    prepareDir(contextUtil.getWinDir());
    prepareDir(contextUtil.getAndroidDir());
    prepareDir(contextUtil.getIosDir());
    prepareDir(contextUtil.getRawDir());
}

function saveJsonObject(jObject, targetDir, type){
    let filePath = path.join(targetDir, `${getFileName(`${contextUtil.getProtocol()}-${type}`)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(jObject, null, 2));

    return filePath;
}

export default { getUserFiles, getFileName, prepareContextDirs, prepareDir, saveJsonObject, getRelativeDestinationFilePath,  getUserDestinationPath };