'use strict';

const EXPANSION_MAX = 100_000;
const EXPANSION_MAX_LENGTH = 4_000_000;
const escSlash = `\0SLASH${Math.random()}\0`;
const escOpen = `\0OPEN${Math.random()}\0`;
const escClose = `\0CLOSE${Math.random()}\0`;
const escComma = `\0COMMA${Math.random()}\0`;
const escPeriod = `\0PERIOD${Math.random()}\0`;
const escSlashPattern = new RegExp(escSlash, 'g');
const escOpenPattern = new RegExp(escOpen, 'g');
const escClosePattern = new RegExp(escClose, 'g');
const escCommaPattern = new RegExp(escComma, 'g');
const escPeriodPattern = new RegExp(escPeriod, 'g');
const slashPattern = /\\\\/g;
const openPattern = /\\{/g;
const closePattern = /\\}/g;
const commaPattern = /\\,/g;
const periodPattern = /\\\./g;

function findBalancedRange(open, close, value) {
    const openings = [];
    let left = value.length;
    let right;
    let result;
    let openIndex = value.indexOf(open);
    let closeIndex = value.indexOf(close, openIndex + 1);
    let currentIndex = openIndex;

    if (openIndex < 0 || closeIndex <= 0) {
        return undefined;
    }
    if (open === close) {
        return [openIndex, closeIndex];
    }

    while (currentIndex >= 0 && !result) {
        if (currentIndex === openIndex) {
            openings.push(currentIndex);
            openIndex = value.indexOf(open, currentIndex + 1);
        } else if (openings.length === 1) {
            result = [openings.pop(), closeIndex];
        } else {
            const opening = openings.pop();
            if (opening !== undefined && opening < left) {
                left = opening;
                right = closeIndex;
            }
            closeIndex = value.indexOf(close, currentIndex + 1);
        }

        currentIndex = openIndex < closeIndex && openIndex >= 0 ? openIndex : closeIndex;
    }

    if (openings.length && right !== undefined) {
        result = [left, right];
    }
    return result;
}

function balanced(open, close, value) {
    const range = findBalancedRange(open, close, value);
    if (!range) {
        return undefined;
    }

    return {
        start: range[0],
        end: range[1],
        pre: value.slice(0, range[0]),
        body: value.slice(range[0] + open.length, range[1]),
        post: value.slice(range[1] + close.length)
    };
}

function numeric(value) {
    return !Number.isNaN(Number(value)) ? Number.parseInt(value, 10) : value.charCodeAt(0);
}

function escapeBraces(value) {
    return value
        .replace(slashPattern, escSlash)
        .replace(openPattern, escOpen)
        .replace(closePattern, escClose)
        .replace(commaPattern, escComma)
        .replace(periodPattern, escPeriod);
}

function unescapeBraces(value) {
    return value
        .replace(escSlashPattern, '\\')
        .replace(escOpenPattern, '{')
        .replace(escClosePattern, '}')
        .replace(escCommaPattern, ',')
        .replace(escPeriodPattern, '.');
}

function parseCommaParts(value) {
    if (!value) {
        return [''];
    }

    const parts = [];
    const match = balanced('{', '}', value);

    if (!match) {
        return value.split(',');
    }

    const segments = match.pre.split(',');
    segments[segments.length - 1] += `{${match.body}}`;

    const postParts = parseCommaParts(match.post);
    if (match.post.length) {
        segments[segments.length - 1] += postParts.shift();
        segments.push(...postParts);
    }

    parts.push(...segments);
    return parts;
}

function combine(accumulator, prefix, values, max, maxLength, dropEmptyValues) {
    const output = [];
    let totalLength = 0;

    for (const accumulatedValue of accumulator) {
        for (const value of values) {
            if (output.length >= max) {
                return output;
            }

            const expansion = accumulatedValue + prefix + value;
            if (dropEmptyValues && !expansion) {
                continue;
            }
            if (totalLength + expansion.length > maxLength) {
                return output;
            }

            output.push(expansion);
            totalLength += expansion.length;
        }
    }

    return output;
}

function expandSequence(body, isAlphaSequence, max) {
    const segments = body.split(/\.\./);
    const output = [];

    if (segments[0] === undefined || segments[1] === undefined) {
        return output;
    }

    const start = numeric(segments[0]);
    const end = numeric(segments[1]);
    const width = Math.max(segments[0].length, segments[1].length);
    let increment =
        segments.length === 3 && segments[2] !== undefined ? Math.max(Math.abs(numeric(segments[2])), 1) : 1;
    let test = (current, last) => current <= last;
    const reverse = end < start;

    if (reverse) {
        increment *= -1;
        test = (current, last) => current >= last;
    }

    const padded = segments.some((segment) => /^-?0\d/.test(segment));
    for (let current = start; test(current, end) && output.length < max; current += increment) {
        let value;
        if (isAlphaSequence) {
            value = String.fromCharCode(current);
            if (value === '\\') {
                value = '';
            }
        } else {
            value = String(current);
            if (padded) {
                const missingWidth = width - value.length;
                if (missingWidth > 0) {
                    const zeros = '0'.repeat(missingWidth);
                    value = current < 0 ? `-${zeros}${value.slice(1)}` : `${zeros}${value}`;
                }
            }
        }
        output.push(value);
    }

    return output;
}

function embrace(value) {
    return `{${value}}`;
}

function expandInternal(value, max, maxLength, isTopLevel) {
    let accumulator = [''];
    let dropEmptyValues = false;
    let firstGroup = true;

    for (;;) {
        const match = balanced('{', '}', value);
        if (!match) {
            return combine(accumulator, value, [''], max, maxLength, dropEmptyValues);
        }

        const prefix = match.pre;
        if (/\$$/.test(prefix)) {
            accumulator = combine(
                accumulator,
                `${prefix}{${match.body}}`,
                [''],
                max,
                maxLength,
                dropEmptyValues && !match.post.length
            );
            firstGroup = false;
            if (!match.post.length) {
                break;
            }
            value = match.post;
            continue;
        }

        const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(match.body);
        const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(match.body);
        const isSequence = isNumericSequence || isAlphaSequence;
        const isOptions = match.body.includes(',');

        if (!isSequence && !isOptions) {
            if (/,(?!,).*\}/.test(match.post)) {
                value = match.pre + `{${match.body}${escClose}${match.post}`;
                isTopLevel = true;
                continue;
            }
            return combine(accumulator, `${prefix}{${match.body}}${match.post}`, [''], max, maxLength, dropEmptyValues);
        }

        if (firstGroup) {
            dropEmptyValues = isTopLevel && !isSequence;
            firstGroup = false;
        }

        let expansionValues;
        if (isSequence) {
            expansionValues = expandSequence(match.body, isAlphaSequence, max);
        } else {
            let parts = parseCommaParts(match.body);
            if (parts.length === 1 && parts[0] !== undefined) {
                parts = expandInternal(parts[0], max, maxLength, false).map(embrace);
                if (parts.length === 1) {
                    accumulator = combine(
                        accumulator,
                        prefix + parts[0],
                        [''],
                        max,
                        maxLength,
                        dropEmptyValues && !match.post.length
                    );
                    if (!match.post.length) {
                        break;
                    }
                    value = match.post;
                    continue;
                }
            }

            expansionValues = [];
            for (const part of parts) {
                expansionValues.push(...expandInternal(part, max, maxLength, false));
            }
        }

        accumulator = combine(
            accumulator,
            prefix,
            expansionValues,
            max,
            maxLength,
            dropEmptyValues && !match.post.length
        );
        if (!match.post.length) {
            break;
        }
        value = match.post;
    }

    return accumulator;
}

function expand(value, options = {}) {
    if (!value) {
        return [];
    }

    const { max = EXPANSION_MAX, maxLength = EXPANSION_MAX_LENGTH } = options;
    const escapedValue = value.slice(0, 2) === '{}' ? `\\{\\}${value.slice(2)}` : value;

    return expandInternal(escapeBraces(escapedValue), max, maxLength, true).map(unescapeBraces);
}

expand.expand = expand;
expand.EXPANSION_MAX = EXPANSION_MAX;
expand.EXPANSION_MAX_LENGTH = EXPANSION_MAX_LENGTH;

module.exports = expand;
