# npm と pre-commit hook

Salesforce DX プロジェクトには、Apex やメタデータ開発だけでなく、LWC、ESLint、Prettier、Jest などの JavaScript 周辺ツールが含まれることがあります。

このリポジトリの初期設定では、コミット時に Husky の pre-commit hook が動き、`lint-staged` を通して staged files にチェックをかける構成になっています。

## 有効な場合のメリット

- コミット前に Markdown、JSON、XML、Apex などのフォーマット崩れを自動修正できる。
- Aura / LWC の JavaScript に ESLint を実行できる。
- LWC 関連ファイルの変更時に関連 Jest テストを実行できる。
- PR 前に機械的な差分や簡単なミスを減らせる。
- 複数人で開発する場合にコードスタイルを揃えやすい。

## 注意点

- `npm install` をしていない環境では、`lint-staged` が見つからずコミットが失敗する。
- Apex / metadata / docs 中心の開発では、LWC 向けのチェックが必須とは限らない。
- `prettier --write` はコミット時にファイルを書き換える。
- pre-commit hook は Salesforce 組織へのデプロイ可否や Apex テスト結果を保証しない。

## このプロジェクトでの考え方

Apex、Salesforce metadata、docs の作業自体は Salesforce CLI が中心で、npm 依存が常に必要なわけではありません。

一方で、このリポジトリでは pre-commit hook、Prettier、ESLint、LWC Jest を使える状態にするため、ローカル開発環境のセットアップとして `npm install` を実行します。

`package-lock.json` は npm 依存の再現性を保つために管理対象とします。

コミット時に hook が依存不足で失敗した場合は、勝手に `npm install` や `--no-verify` を実行せず、先に方針を確認します。
