'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const expand = require('../index.cjs');

test('CommonJSの関数APIと名前付きAPIを両方提供する', () => {
    assert.deepEqual(expand('file-{a,b}.txt'), ['file-a.txt', 'file-b.txt']);
    assert.equal(expand.expand, expand);
});

test('ES Modulesの名前付きAPIを提供する', async () => {
    const module = await import('../index.mjs');

    assert.deepEqual(module.expand('file-{1..2}.txt'), ['file-1.txt', 'file-2.txt']);
    assert.equal(module.default, module.expand);
});

test('展開結果の合計長を指定上限以内に抑える', () => {
    const maxLength = 50;
    const result = expand('{a,b}'.repeat(20), {
        max: 100_000,
        maxLength
    });
    const totalLength = result.reduce((length, value) => length + value.length, 0);

    assert.ok(totalLength <= maxLength);
});
