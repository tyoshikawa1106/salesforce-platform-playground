const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { checkUrl, formatSuccessSummary, isRetryableStatus, normalizeUrl } = require('../check-external-links');

test('Markdown の閉じ記号を URL から除外する', () => {
    assert.equal(normalizeUrl('https://example.com/guide).'), 'https://example.com/guide');
    assert.equal(normalizeUrl('https://example.com/a_(b)'), 'https://example.com/a_(b)');
});

test('HEAD と GET の応答の組み合わせを判定する', async (context) => {
    let transientHeadRequests = 0;
    const server = http.createServer((request, response) => {
        if (request.url === '/transient' && request.method === 'HEAD') {
            transientHeadRequests += 1;
            response.writeHead(transientHeadRequests === 1 ? 503 : 200);
            response.end();
            return;
        }

        const responses = {
            '/ok': { HEAD: 200, GET: 200 },
            '/broken': { HEAD: 404, GET: 404 },
            '/flaky': { HEAD: 403, GET: 404 },
            '/restricted': { HEAD: 403, GET: 403 },
            '/unavailable': { HEAD: 503, GET: 503 }
        };
        const status = responses[request.url]?.[request.method] || 500;

        response.writeHead(status);
        response.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    context.after(() => new Promise((resolve) => server.close(resolve)));

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const requestOptions = { delayMs: 0 };

    assert.deepEqual(await checkUrl(`${baseUrl}/ok`, requestOptions), { kind: 'ok', status: 200 });
    assert.deepEqual(await checkUrl(`${baseUrl}/broken`, requestOptions), {
        kind: 'broken',
        message: 'HEAD HTTP 404, GET HTTP 404'
    });
    assert.deepEqual(await checkUrl(`${baseUrl}/flaky`, requestOptions), {
        kind: 'warning',
        message: 'HEAD HTTP 403, GET HTTP 404'
    });
    assert.deepEqual(await checkUrl(`${baseUrl}/restricted`, requestOptions), { kind: 'warning', status: 403 });
    assert.deepEqual(await checkUrl(`${baseUrl}/transient`, requestOptions), { kind: 'ok', status: 200 });
    assert.equal(transientHeadRequests, 2);
    assert.deepEqual(await checkUrl(`${baseUrl}/unavailable`, requestOptions), { kind: 'warning', status: 503 });
});

test('一時的な HTTP status を再試行対象として判定する', () => {
    assert.equal(isRetryableStatus(429), true);
    assert.equal(isRetryableStatus(500), true);
    assert.equal(isRetryableStatus(503), true);
    assert.equal(isRetryableStatus(404), false);
    assert.equal(isRetryableStatus(403), false);
});

test('警告の有無を完了メッセージに反映する', () => {
    assert.equal(formatSuccessSummary(10, 0), 'External link check passed: 10 checked.');
    assert.equal(formatSuccessSummary(10, 2), 'External link check completed with warnings: 10 checked, 2 warning.');
});
