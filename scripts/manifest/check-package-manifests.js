const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const manifestRoot = path.join(projectRoot, 'manifest');
const mainManifestPath = path.join(manifestRoot, 'package.xml');
const docsPath = path.join(projectRoot, 'docs/knowledge/salesforce-package-xml-metadata-types.md');
const issues = [];

function isEnglishOnly(value) {
    return /[A-Za-z]/.test(value) && !/[ぁ-んァ-ヶ一-龠]/.test(value);
}

function parseManifest(filePath) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(projectRoot, filePath);
    const metadataEntries = [...xml.matchAll(/<types>([\s\S]*?)<\/types>/g)].map((match) => {
        const nameMatch = match[1].match(/<name>([^<]+)<\/name>/);

        if (!nameMatch) {
            issues.push(`${relativePath}: <types> に <name> がありません。`);
            return null;
        }

        const precedingText = xml.slice(0, match.index);
        const precedingComments = [...precedingText.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)];
        const commentMatch = precedingComments.at(-1);
        const textAfterComment = commentMatch
            ? precedingText.slice(commentMatch.index + commentMatch[0].length)
            : precedingText;

        if (!commentMatch || !/^\s*$/.test(textAfterComment)) {
            issues.push(`${relativePath}: ${nameMatch[1]} の直前にコメントがありません。`);
        }

        return {
            comment: commentMatch?.[1].trim(),
            metadataType: nameMatch[1]
        };
    });
    const versionMatch = xml.match(/<version>([^<]+)<\/version>/);

    for (const commentMatch of xml.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)) {
        const comment = commentMatch[1].trim();

        if (isEnglishOnly(comment)) {
            issues.push(`${relativePath}: 英語のみのコメント「${comment}」が残っています。`);
        }
    }

    if (!versionMatch) {
        issues.push(`${relativePath}: <version> がありません。`);
    }

    return {
        metadataEntries: metadataEntries.filter(Boolean),
        metadataTypes: metadataEntries.filter(Boolean).map((entry) => entry.metadataType),
        version: versionMatch?.[1]
    };
}

const mainManifest = parseManifest(mainManifestPath);
const mainMetadataTypeSet = new Set();
const mainComments = new Map();

mainManifest.metadataEntries.forEach(({ comment, metadataType }) => {
    if (mainMetadataTypeSet.has(metadataType)) {
        issues.push(`${metadataType}: package.xml 内で重複しています。`);
    } else {
        mainMetadataTypeSet.add(metadataType);
        mainComments.set(metadataType, comment);
    }
});

const splitManifestPaths = fs
    .readdirSync(manifestRoot)
    .filter((fileName) => /^package-.+\.xml$/.test(fileName))
    .map((fileName) => path.join(manifestRoot, fileName))
    .sort();
const splitMetadataOwners = new Map();
const splitCounts = new Map();

splitManifestPaths.forEach((filePath) => {
    const manifest = parseManifest(filePath);
    const relativePath = path.relative(projectRoot, filePath);

    splitCounts.set(relativePath, manifest.metadataTypes.length);

    if (manifest.version !== mainManifest.version) {
        issues.push(
            `${relativePath}: API version ${manifest.version} が package.xml の ${mainManifest.version} と一致しません。`
        );
    }

    manifest.metadataEntries.forEach(({ comment, metadataType }) => {
        const previousOwner = splitMetadataOwners.get(metadataType);

        if (previousOwner) {
            issues.push(`${metadataType}: ${previousOwner} と ${relativePath} に重複しています。`);
        } else {
            splitMetadataOwners.set(metadataType, relativePath);
        }

        if (mainComments.has(metadataType) && mainComments.get(metadataType) !== comment) {
            issues.push(
                `${metadataType}: package.xml のコメント「${mainComments.get(metadataType)}」と ${relativePath} の「${comment}」が一致しません。`
            );
        }
    });
});

mainMetadataTypeSet.forEach((metadataType) => {
    if (!splitMetadataOwners.has(metadataType)) {
        issues.push(`${metadataType}: 分割 manifest にありません。`);
    }
});

splitMetadataOwners.forEach((_, metadataType) => {
    if (!mainMetadataTypeSet.has(metadataType)) {
        issues.push(`${metadataType}: package.xml にありません。`);
    }
});

const docs = fs.readFileSync(docsPath, 'utf8');
const documentedCounts = new Map(
    [...docs.matchAll(/^\| `(?<file>manifest\/package-[^`]+\.xml)`\s*\|[^|]+\|\s*(?<count>\d+)\s*\|$/gm)].map(
        (match) => [match.groups.file, Number(match.groups.count)]
    )
);
const documentedMetadataDescriptions = new Map();

for (const match of docs.matchAll(/^\| `(?<metadataType>[^`]+)`\s*\|\s*(?<description>[^|]+?)\s*\|$/gm)) {
    const { description, metadataType } = match.groups;

    if (!mainMetadataTypeSet.has(metadataType)) {
        continue;
    }

    if (documentedMetadataDescriptions.has(metadataType)) {
        continue;
    }

    const trimmedDescription = description.trim();
    documentedMetadataDescriptions.set(metadataType, trimmedDescription);

    if (isEnglishOnly(trimmedDescription)) {
        issues.push(`${metadataType}: docs に英語のみの説明「${trimmedDescription}」が残っています。`);
    }
}

mainMetadataTypeSet.forEach((metadataType) => {
    if (!documentedMetadataDescriptions.has(metadataType)) {
        issues.push(`${metadataType}: docs の metadata 一覧に説明がありません。`);
    }
});

splitCounts.forEach((count, relativePath) => {
    if (!documentedCounts.has(relativePath)) {
        issues.push(`${relativePath}: docs の分割 manifest 一覧にありません。`);
    } else if (documentedCounts.get(relativePath) !== count) {
        issues.push(
            `${relativePath}: docs の件数 ${documentedCounts.get(relativePath)} が実際の ${count} と一致しません。`
        );
    }
});

documentedCounts.forEach((_, relativePath) => {
    if (!splitCounts.has(relativePath)) {
        issues.push(`${relativePath}: docs にありますがファイルが存在しません。`);
    }
});

if (!docs.includes(`メタデータ型 ${mainManifest.metadataTypes.length} 件`)) {
    issues.push(`docs: package.xml の件数 ${mainManifest.metadataTypes.length} が本文と一致しません。`);
}

if (issues.length > 0) {
    console.error(`Manifest check failed with ${issues.length} issue(s):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
} else {
    console.log(
        `Manifest check passed: ${mainManifest.metadataTypes.length} metadata types across ${splitManifestPaths.length} split manifests.`
    );
}
