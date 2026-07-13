const path = require('path');
const fs = require('fs');
const { getManagedMarkdownFiles, projectRoot } = require('./markdown-files');
const requestTimeoutMs = 15000;
const requestAttempts = 3;
const retryDelayMs = 250;
const concurrency = 8;

function normalizeUrl(rawUrl) {
    let url = rawUrl.trim().replace(/[.,;:!?\]}>、。）」』】]+$/u, '');

    while (url.endsWith(')')) {
        const openingCount = (url.match(/\(/g) || []).length;
        const closingCount = (url.match(/\)/g) || []).length;

        if (closingCount <= openingCount) {
            break;
        }

        url = url.slice(0, -1);
    }

    return url;
}

function extractExternalLinks(filePath) {
    const links = [];
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let inFence = false;

    lines.forEach((line, index) => {
        if (line.trimStart().startsWith('```')) {
            inFence = !inFence;
            return;
        }

        if (inFence) {
            return;
        }

        const urlPattern = /https?:\/\/[^\s<>"`]+/g;
        let match;

        while ((match = urlPattern.exec(line)) !== null) {
            const url = normalizeUrl(match[0]);

            if (url) {
                links.push({ filePath, line: index + 1, url });
            }
        }
    });

    return links;
}

async function request(url, method) {
    const response = await fetch(url, {
        method,
        redirect: 'follow',
        headers: {
            Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            'User-Agent': 'salesforce-platform-playground-docs-link-check'
        },
        signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (response.body) {
        await response.body.cancel();
    }

    return response.status;
}

function isRetryableStatus(status) {
    return status === 429 || (status >= 500 && status < 600);
}

async function wait(delayMs) {
    if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
}

async function requestWithRetry(url, method, options = {}) {
    const attempts = options.attempts || requestAttempts;
    const delayMs = options.delayMs ?? retryDelayMs;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const status = await request(url, method);

            if (!isRetryableStatus(status) || attempt === attempts) {
                return status;
            }
        } catch (error) {
            if (attempt === attempts) {
                throw error;
            }
        }

        await wait(delayMs * attempt);
    }

    throw new Error(`Request failed without a response: ${method} ${url}`);
}

async function checkUrl(url, requestOptions = {}) {
    let headStatus;
    let headError;

    try {
        headStatus = await requestWithRetry(url, 'HEAD', requestOptions);

        if (headStatus >= 200 && headStatus < 400) {
            return { kind: 'ok', status: headStatus };
        }
    } catch (error) {
        headError = error.message;
    }

    try {
        const getStatus = await requestWithRetry(url, 'GET', requestOptions);

        if (getStatus >= 200 && getStatus < 400) {
            return { kind: 'ok', status: getStatus };
        }

        if ((getStatus === 404 || getStatus === 410) && (headStatus === 404 || headStatus === 410)) {
            return { kind: 'broken', message: `HEAD HTTP ${headStatus}, GET HTTP ${getStatus}` };
        }

        if (getStatus === 404 || getStatus === 410) {
            const headDetail = headStatus ? `HTTP ${headStatus}` : headError;

            return { kind: 'warning', message: `HEAD ${headDetail}, GET HTTP ${getStatus}` };
        }

        return { kind: 'warning', status: getStatus };
    } catch (error) {
        return { kind: 'warning', message: error.message };
    }
}

function formatSuccessSummary(urlCount, warningCount) {
    if (warningCount > 0) {
        return `External link check completed with warnings: ${urlCount} checked, ${warningCount} warning.`;
    }

    return `External link check passed: ${urlCount} checked.`;
}

const markdownFiles = getManagedMarkdownFiles();
const linkReferences = new Map();

markdownFiles.flatMap(extractExternalLinks).forEach((link) => {
    const references = linkReferences.get(link.url) || [];

    references.push(link);
    linkReferences.set(link.url, references);
});

const urls = [...linkReferences.keys()].sort();
const results = new Map();
let nextIndex = 0;

async function worker() {
    while (nextIndex < urls.length) {
        const index = nextIndex;
        nextIndex += 1;
        const url = urls[index];

        results.set(url, await checkUrl(url));
    }
}

async function main() {
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

    let brokenCount = 0;
    let warningCount = 0;

    urls.forEach((url) => {
        const result = results.get(url);

        if (result.kind === 'ok') {
            return;
        }

        const references = linkReferences
            .get(url)
            .map(({ filePath, line }) => `${path.relative(projectRoot, filePath)}:${line}`)
            .join(', ');
        const detail = result.status ? `HTTP ${result.status}` : result.message;

        if (result.kind === 'broken') {
            brokenCount += 1;
            console.error(`BROKEN ${detail}: ${url} (${references})`);
            return;
        }

        warningCount += 1;
        console.warn(`WARNING ${detail}: ${url} (${references})`);
    });

    if (brokenCount > 0) {
        console.error(
            `External link check failed: ${brokenCount} broken, ${warningCount} warning, ${urls.length} checked.`
        );
        process.exitCode = 1;
        return;
    }

    console.log(formatSuccessSummary(urls.length, warningCount));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = {
    checkUrl,
    formatSuccessSummary,
    isRetryableStatus,
    normalizeUrl
};
