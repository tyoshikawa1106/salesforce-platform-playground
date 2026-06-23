#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const targetOrg = process.argv[2];

if (!targetOrg) {
    console.error(
        'Usage: node scripts/deployment/generate-client-credentials-policy.js <target-org>'
    );
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..', '..');
const templatePath = path.join(
    repoRoot,
    'scratch-org',
    'templates',
    'client-credentials',
    'extlClntAppOauthPolicies',
    'Salesforce_API_Playground_Integration_oauthPlcy.ecaOauthPlcy-meta.xml'
);
const outputDir = path.join(
    repoRoot,
    'scratch-org',
    'generated',
    'client-credentials',
    'main',
    'default',
    'extlClntAppOauthPolicies'
);
const outputPath = path.join(
    outputDir,
    'Salesforce_API_Playground_Integration_oauthPlcy.ecaOauthPlcy-meta.xml'
);

const orgJson = execFileSync(
    'sf',
    ['org', 'display', '--target-org', targetOrg, '--json'],
    { encoding: 'utf8' }
);
const org = JSON.parse(orgJson);
const username = org.result && org.result.username;

if (!username) {
    console.error(`Could not resolve username for target org: ${targetOrg}`);
    process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');
const output = template.replace('__CLIENT_CREDENTIALS_FLOW_USER__', username);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, output);

console.log(`Generated ${path.relative(repoRoot, outputPath)}`);
console.log(`clientCredentialsFlowUser=${username}`);
