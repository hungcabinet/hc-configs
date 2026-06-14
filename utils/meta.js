import files from "./files.js";
import config from "./config.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function fileHash(path) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(path);

        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function refreshMeta(user) {
    const now = Math.floor(Date.now() / 1000);

    let commonConfig = config.getCommonConfig();

    let userDestinationPath = files.getUserDestinationPath(commonConfig, user)
    let userMetaPath = path.join(userDestinationPath, "meta.json");

    //fs.writeFileSync(userMetaPath, "{}");

    if (!fs.existsSync(userMetaPath)) {
        fs.writeFileSync(userMetaPath, "{}");
    }

    let data = JSON.parse(fs.readFileSync(userMetaPath));

    const srvDirs = fs.readdirSync(userDestinationPath, { withFileTypes: true }).filter(data => data.isDirectory());

    for (const srvDir of srvDirs) {
        const srvName = srvDir.name;
        const srvPath = path.join(userDestinationPath, srvName);

        const platformDirs = fs.readdirSync(srvPath, { withFileTypes: true }).filter(data => data.isDirectory());

        for (const platformDir of platformDirs) {
            const platformName = platformDir.name;
            const platformPath = path.join(srvPath, platformName);

            const fileEntities = fs.readdirSync(platformPath, { withFileTypes: true }).filter(data => !data.isDirectory());

            for (const fileEntity of fileEntities) {
                const fileName = fileEntity.name;
                const filePath = path.join(platformPath, fileName);

                const hash = await fileHash(filePath);

                let relativePath = files.getRelativeDestinationFilePath(filePath, user)
                    .replaceAll("\\", "/");

                relativePath = `/${relativePath}`;

                let fileMeta = data[relativePath];

                if (fileMeta === undefined) {
                    fileMeta = {
                        hash,
                        time: now
                    }

                    data[relativePath] = fileMeta;
                }

                if (fileMeta.hash !== hash) {
                    fileMeta.hash = hash;
                    fileMeta.time = now;
                }
            }
        }
    }

    fs.writeFileSync(userMetaPath, JSON.stringify(data, null, 2));

    return data;
}

export default {refreshMeta};