import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from "os";

async function syncDstFiles(destinationFilesDir, rsyncData){
    if (process.platform() !== 'linux') {
        console.log(`Not linux platform (${process.platform()}). Skip rsync call`);
        return;
    }

    if (rsyncData?.host === undefined || rsyncData?.destination === undefined || rsyncData?.user === undefined) {
        return;
    }

    const execFileAsync = promisify(execFile);

    await execFileAsync('rsync', [
        '-avz',
        '--delete',
        destinationFilesDir.endsWith("/") ? destinationFilesDir: `${destinationFilesDir}/`,
        `${rsyncData.user}@${rsyncData.host}:${rsyncData.destination}`
    ])
}

export default {syncDstFiles};