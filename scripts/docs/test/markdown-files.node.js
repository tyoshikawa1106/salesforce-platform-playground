const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getManagedMarkdownFiles, projectRoot } = require('../markdown-files');

test('Git 管理する入口文書とテンプレートを検査対象に含める', () => {
    const markdownFiles = getManagedMarkdownFiles();
    const relativePaths = markdownFiles.map((filePath) => path.relative(projectRoot, filePath));

    assert.equal(new Set(markdownFiles).size, markdownFiles.length);
    assert.ok(relativePaths.includes('.github/pull_request_template.md'));
    assert.ok(relativePaths.includes('.clinerules/repository.md'));
    assert.ok(relativePaths.includes('.cline/skills/salesforce-skills/SKILL.md'));
    assert.ok(markdownFiles.every((filePath) => fs.existsSync(filePath)));
});
