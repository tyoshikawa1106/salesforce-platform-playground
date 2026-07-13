const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { checkUrl, normalizeUrl } = require('../check-external-links');

test('Markdown の閉じ記号を URL から除外する', () => {
    assert.equal(normalizeUrl('https://example.com/guide).'), 'https://example.com/guide');
    assert.equal(normalizeUrl('https://example.com/a_(b)'), 'https://example.com/a_(b)');
});

test('HEAD と GET の応答の組み合わせを判定する', async (context) => {
    const server = http.createServer((request, response) => {
        const responses = {
            '/ok': { HEAD: 200, GET: 200 },
            '/broken': { HEAD: 404, GET: 404 },
            '/flaky': { HEAD: 403, GET: 404 },
            '/restricted': { HEAD: 403, GET: 403 }
        };
        const status = responses[request.url]?.[request.method] || 500;

        response.writeHead(status);
        response.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    context.after(() => new Promise((resolve) => server.close(resolve)));

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    assert.deepEqual(await checkUrl(`${baseUrl}/ok`), { kind: 'ok', status: 200 });
    assert.deepEqual(await checkUrl(`${baseUrl}/broken`), {
        kind: 'broken',
        message: 'HEAD HTTP 404, GET HTTP 404'
    });
    assert.deepEqual(await checkUrl(`${baseUrl}/flaky`), {
        kind: 'warning',
        message: 'HEAD HTTP 403, GET HTTP 404'
    });
    assert.deepEqual(await checkUrl(`${baseUrl}/restricted`), { kind: 'warning', status: 403 });
});
