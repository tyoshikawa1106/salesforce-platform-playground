const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getManagedMarkdownFiles, projectRoot } = require('../markdown-files');

test('Git 管理する現行文書を検査対象に含め、履歴文書を除外する', () => {
    const markdownFiles = getManagedMarkdownFiles();
    const relativePaths = markdownFiles.map((filePath) => path.relative(projectRoot, filePath));

    assert.equal(new Set(markdownFiles).size, markdownFiles.length);
    assert.ok(relativePaths.includes('.github/pull_request_template.md'));
    assert.ok(relativePaths.includes('.clinerules/repository.md'));
    assert.ok(relativePaths.includes('.cline/skills/salesforce-skills/SKILL.md'));
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('.agents/skills/')));
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('docs/knowledge/')));
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('docs/discussions/')));
    assert.ok(markdownFiles.every((filePath) => fs.existsSync(filePath)));
});
