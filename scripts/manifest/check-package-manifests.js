const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const manifestRoot = path.join(projectRoot, 'manifest');
const mainManifestPath = path.join(manifestRoot, 'package.xml');
const docsPath = path.join(projectRoot, 'docs/knowledge/salesforce-package-xml-metadata-types.md');
const issues = [];

function parseManifest(filePath) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const metadataTypes = [...xml.matchAll(/<types>([\s\S]*?)<\/types>/g)].map((match) => {
        const nameMatch = match[1].match(/<name>([^<]+)<\/name>/);

        if (!nameMatch) {
            issues.push(`${path.relative(projectRoot, filePath)}: <types> に <name> がありません。`);
            return null;
        }

        return nameMatch[1];
    });
    const versionMatch = xml.match(/<version>([^<]+)<\/version>/);

    if (!versionMatch) {
        issues.push(`${path.relative(projectRoot, filePath)}: <version> がありません。`);
    }

    return {
        metadataTypes: metadataTypes.filter(Boolean),
        version: versionMatch?.[1]
    };
}

const mainManifest = parseManifest(mainManifestPath);
const mainMetadataTypeSet = new Set();

mainManifest.metadataTypes.forEach((metadataType) => {
    if (mainMetadataTypeSet.has(metadataType)) {
        issues.push(`${metadataType}: package.xml 内で重複しています。`);
    } else {
        mainMetadataTypeSet.add(metadataType);
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

    manifest.metadataTypes.forEach((metadataType) => {
        const previousOwner = splitMetadataOwners.get(metadataType);

        if (previousOwner) {
            issues.push(`${metadataType}: ${previousOwner} と ${relativePath} に重複しています。`);
        } else {
            splitMetadataOwners.set(metadataType, relativePath);
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

if (!docs.includes(`metadata type ${mainManifest.metadataTypes.length} 件`)) {
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
