import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from "os";

const execFileAsync = promisify(execFile);

async function updateRemoteUsers(webServerConfig) {
    if (process.platform() !== 'linux') {
        console.log(`Not linux platform (${process.platform()}). Skip sshAuth call`);
        return;
    }

    const sshAuth = webServerConfig.sshAuth;
    if (!sshAuth || !sshAuth.enabled) {
        return;
    }

    const host = sshAuth.host;
    if (!host) {
        console.warn('SSH Auth enabled but host is not defined. Skipping.');
        return;
    }

    const users = webServerConfig.users || [];
    if (users.length === 0) {
        return;
    }

    console.log(`Updating remote users in ${sshAuth.htpasswdPath} on ${host}...`);

    for (const user of users) {
        try {
            // Use htpasswd -b (batch mode) to update/create user with password
            // We use -c only for the first user if the file doesn't exist, but it's safer to assume it exists or use -b which updates if exists.
            // Actually, -b just takes password from cmdline.
            // We'll run them one by one.
            await execFileAsync('ssh', [
                `${sshAuth.user}@${host}`,
                `sudo htpasswd -b ${sshAuth.htpasswdPath} ${user.userName} ${user.password}`
            ]);
            console.log(`  User ${user.userName} updated.`);
        } catch (error) {
            console.error(`  Failed to update user ${user.userName}: ${error.message}`);
        }
    }
}

export default { updateRemoteUsers };
