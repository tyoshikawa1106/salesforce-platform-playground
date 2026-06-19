# ローカル開発環境

このプロジェクトでは、Salesforce CLI と npm 依存を使って開発します。

## 前提

- Salesforce CLI
- Node.js / npm
- Dev 組織へのログイン

## 初期セットアップ

```sh
npm install
```

`npm install` は、Husky、lint-staged、Prettier、ESLint、LWC Jest など、コミット前チェックや LWC 開発に必要な npm 依存をインストールします。

`package-lock.json` は npm 依存の再現性を保つために管理対象とします。

## Prettier

Salesforce 開発では Apex、metadata、LWC を 4 spaces で扱います。

このプロジェクトの Prettier 設定は、Salesforce のサンプルギャラリーで使われている DreamHouse、E-Bikes、LWC Recipes、Apex Recipes の構成を参考にします。

- `.prettierrc` で `tabWidth: 4` を明示する。
- `singleQuote: true` と `trailingComma: none` を使う。
- `prettier-plugin-apex` と `@prettier/plugin-xml` を使う。
- `npm run prettier` は手動の整形コマンドとして用意する。
- `npm run prettier:verify` は整形確認用として使う。
- `lint-staged` では staged files に対して Prettier の自動 write を実行する。

`prettier --write` は対象ファイルを書き換えるため、Apex や Salesforce metadata を含む変更では実行後に `git diff` を確認します。
コミット時にも staged files が書き換わる可能性があるため、コミット後に `git show` や `git diff HEAD^ HEAD` で実際に入った差分を確認します。

## Salesforce CLI

CLI の動作確認:

```sh
sf --version
```

Dev 組織へログインする場合:

```sh
sf org login web --set-default --alias dev
```

接続済みの Salesforce 組織に対する deploy、delete、retrieve、test などの操作は、実行前に対象と目的を確認します。
開発タスクで deploy や Apex test を行う場合は、現在接続されている組織だけを対象にし、明示依頼なしに target org を切り替えません。
