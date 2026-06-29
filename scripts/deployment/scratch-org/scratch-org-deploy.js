#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/scratch-org-deploy.js

const { execSync } = require('node:child_process');
const path = require('node:path');
const scratchOrg = require('./scratch-org.json');

process.chdir(path.resolve(__dirname, '../../..'));

// Scratch Org 初期反映用 manifest を反映する。
execSync(`sf project deploy start --manifest ${scratchOrg.manifest} --target-org ${scratchOrg.alias} --wait ${scratchOrg.waitMinutes}`, { stdio: 'inherit' });
