import path from 'path';

function getProfileId(fileName, protocolName) {
    const stem = path.basename(fileName, path.extname(fileName));

    return stem.toLowerCase() === protocolName ? undefined : stem;
}

export default { getProfileId };
