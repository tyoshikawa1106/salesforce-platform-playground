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
