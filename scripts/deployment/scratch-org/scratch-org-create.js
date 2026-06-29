#!/usr/bin/env node
// Run: node scripts/deployment/scratch-org/scratch-org-create.js

const { execSync } = require('node:child_process');
const path = require('node:path');
const scratchOrg = require('./scratch-org.json');

process.chdir(path.resolve(__dirname, '../../..'));

// Scratch Org を作成する。
execSync(`sf org create scratch --definition-file ${scratchOrg.definitionFile} --alias ${scratchOrg.alias} --duration-days ${scratchOrg.durationDays}`, { stdio: 'inherit' });
