// 用途: Scratch Orgの資格情報登録中だけREST APIでシークレットを取得できるようにする。

const { mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { sourceApiVersion } = require('../../../sfdx-project.json');
const { repoRoot, scratchOrg } = require('./context');

const namespace = 'http://soap.sforce.com/2006/04/metadata';
const settingsFile = 'ExternalClientApp.settings';

function withRestSecretAccess({ username, directory, runSfCommand }, registerCredentials) {
    const retrievedDirectory = path.join(directory, 'rest-secret-access-original');
    const targetArgs = ['--target-org', username, '--wait', String(scratchOrg.waitMinutes)];
    const retrieved = runSfCommand(
        [
            'project',
            'retrieve',
            'start',
            '--metadata',
            'Settings:ExternalClientApp',
            '--target-metadata-dir',
            retrievedDirectory,
            '--unzip',
            ...targetArgs
        ],
        repoRoot
    );
    if (retrieved !== 0) throw new Error('Scratch Orgのシークレット参照設定を取得できません。');
    const files = readdirSync(retrievedDirectory, { recursive: true }).filter(
        (file) => path.basename(file) === settingsFile
    );
    if (files.length !== 1) throw new Error('Scratch Orgのシークレット参照設定を一意に確認できません。');
    const original = new XMLParser({ ignoreAttributes: false }).parse(
        readFileSync(path.join(retrievedDirectory, files[0]), 'utf8')
    ).ExternalClientAppSettings;
    const enabled = original?.enableClientSecretInRestApiAccess;
    if (original?.['@_xmlns'] !== namespace || typeof enabled !== 'boolean') {
        throw new Error('Scratch Orgのシークレット参照設定を確認できません。');
    }
    if (enabled) return registerCredentials();

    const packageDirectory = path.join(directory, 'rest-secret-access-deploy');
    const settingsDirectory = path.join(packageDirectory, 'settings');
    mkdirSync(settingsDirectory, { recursive: true });
    writeFileSync(
        path.join(packageDirectory, 'package.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="${namespace}">
    <types><members>ExternalClientApp</members><name>Settings</name></types>
    <version>${sourceApiVersion}</version>
</Package>\n`
    );

    function deployAccess(value) {
        writeFileSync(
            path.join(settingsDirectory, settingsFile),
            `<?xml version="1.0" encoding="UTF-8"?>
<ExternalClientAppSettings xmlns="${namespace}">
    <enableClientSecretInRestApiAccess>${value}</enableClientSecretInRestApiAccess>
</ExternalClientAppSettings>\n`
        );
        return runSfCommand(
            [
                'project',
                'deploy',
                'start',
                '--metadata-dir',
                packageDirectory,
                '--test-level',
                'NoTestRun',
                ...targetArgs
            ],
            repoRoot
        );
    }

    let registrationError;
    let restoreStatus;
    try {
        if (deployAccess(true) !== 0) throw new Error('Scratch Orgのシークレット参照を一時的に有効化できません。');
        registerCredentials();
    } catch (error) {
        registrationError = error;
    } finally {
        restoreStatus = deployAccess(false);
    }
    if (restoreStatus !== 0) {
        throw new Error('Scratch Orgのシークレット参照設定を復元できません。', { cause: registrationError });
    }
    if (registrationError) throw registrationError;
}

module.exports = { withRestSecretAccess };
