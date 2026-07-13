# npmとpre-commitフック

Salesforce DX プロジェクトには、Apex やメタデータ開発だけでなく、LWC、ESLint、Prettier、Jest などの JavaScript 周辺ツールが含まれることがあります。

このリポジトリでは、コミット時にHuskyのpre-commitフックが動き、`lint-staged`を通してステージ済みファイルにチェックをかける構成になっています。

## 有効な場合のメリット

- Aura / LWC の JavaScript に ESLint を実行できる。
- LWC 関連ファイルの変更時に関連 Jest テストを実行できる。
- PR 前に機械的な差分や簡単なミスを減らせる。
- 複数人で開発する場合にコードスタイルを揃えやすい。

## 注意点

- `npm install` をしていない環境では、`lint-staged` が見つからずコミットが失敗する。
- Apex / metadata / docs 中心の開発では、LWC 向けのチェックが必須とは限らない。
- `prettier --write`はファイルを書き換えるため、pre-commitフックの実行後は実際の差分を確認する。
- pre-commitフックはSalesforce組織へのデプロイ可否やApexテスト結果を保証しない。

## このプロジェクトでの考え方

Apex、Salesforce metadata、docs の作業自体は Salesforce CLI が中心で、npm 依存が常に必要なわけではありません。

一方で、このリポジトリではpre-commitフック、Prettier、ESLint、LWC Jestを使える状態にするため、プロジェクト側の準備として`npm ci`を実行します。

Prettierの確認コマンドと手動の書き込みコマンドを残し、pre-commitフックでもステージ済みファイルに対して`prettier --write`を実行します。

`package-lock.json` は npm 依存の再現性を保つために管理対象とします。

コミット時にフックが依存不足で失敗した場合は、勝手に`npm install`や`--no-verify`を実行せず、先に方針を確認します。

通常の確認コマンドは [ローカル開発コマンド](local-development-commands.md) を参照します。
