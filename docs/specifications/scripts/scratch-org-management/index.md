# Scratch Org管理スクリプト

## 概要

設定ファイルに従ってScratch Orgの作成、metadata反映、Permission Set割り当て、テストデータ投入を順番に行い、明示されたaliasのScratch Orgを削除するNode.jsスクリプトです。

## 目的・利用場面

このリポジトリの開発・確認環境をScratch Orgへ再現するときと、確認済みのScratch Orgを削除するときに使用します。

## 対象実装・メタデータ

| 種別             | パス                                   | 役割                                                |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| Node.js script   | `scripts/scratch-org/setup.js`         | 4つの準備stepを同じaliasで順番に実行する            |
| Node.js script   | `scripts/scratch-org/delete.js`        | 明示されたaliasのScratch Orgを削除する              |
| 設定             | `scripts/scratch-org/scratch-org.json` | 既定alias、期間、manifest、権限、待機時間を定義する |
| Node.js modules  | `scripts/scratch-org/internal/`        | alias引数、共通設定、終了状態を処理する             |
| step scripts     | `scripts/scratch-org/steps/`           | 作成、反映、権限、データ投入を個別実行する          |
| manifest         | `manifest/rebuild-scratch-org.xml`     | 初期metadata反映scopeを定義する                     |
| Scratch定義      | `config/project-scratch-def.json`      | Scratch Orgのedition、features、settingsを定義する  |
| テストスクリプト | `scripts/scratch-org/test/*.node.js`   | 引数、step順序、CLI引数、manifest整合を検証する     |

## 入力

準備は次の形式で実行します。

```sh
node scripts/scratch-org/setup.js [--alias <alias>]
```

alias未指定時は`scratch-org.json`の既定値を使用します。削除では対象の取り違えを避けるため、aliasを必須とします。

```sh
node scripts/scratch-org/delete.js --alias <alias>
```

各コマンドは`--help`または`-h`で使用方法を表示し、`--alias`以外の引数を拒否します。

## 処理内容

### Scratch Orgの準備

1. `sf org create scratch`でScratch定義、alias、有効日数を指定して作成する。
2. `manifest/rebuild-scratch-org.xml`を`RunLocalTests`と設定済み待機時間でdeployする。
3. 設定済みPermission SetをScratch Orgユーザーへ割り当てる。
4. 共通のテストデータ投入スクリプトへ作成済みalias、import plan、`--default-repeat 40`を渡す。

各stepは子Node.jsプロセスとして順番に実行し、非0終了した時点で後続stepを実行しません。テストデータ投入stepでは接続組織を表示し、利用者の承認後に投入します。

### Scratch Orgの削除

検証済みのaliasを`sf org delete scratch --target-org <alias>`へ渡します。`--no-prompt`を指定しないため、Salesforce CLIの削除確認が表示されます。

## 出力・更新対象

- 準備処理はScratch Orgを作成し、metadata、Permission Set、テストデータを反映します。
- 削除処理はSalesforce CLIで確認されたScratch Orgを削除します。
- setup開始時と作成stepで使用aliasを表示します。
- 失敗時は停止したstep名と子プロセスの終了コードを返します。

## 権限・実行条件

- Node.jsとSalesforce CLIを利用でき、Scratch Orgを作成できるDev Hubが設定されている必要があります。
- Scratch定義のfeatureと設定がDev Hubで利用できる必要があります。
- metadata反映、Permission Set割り当て、テストデータ投入に必要な権限が必要です。
- 削除は利用者が対象を確認し、明示依頼した場合だけ実行します。

## エラー処理

- alias引数が不正な場合はSalesforce CLIを実行せず、エラーと使用方法を表示します。
- 準備stepが失敗した場合は後続stepを実行しません。
- 途中失敗時も、作成済みScratch Org、反映済みmetadata、割り当て済み権限、投入済みデータを自動でロールバックまたは削除しません。
- テストデータ投入の承認拒否は投入を行わず正常終了するため、setup全体も正常終了します。

## 関連コンポーネント

- [Scratch Org再現ルール](../../../deployment/scratch-org-rebuild-rules.md)
- [Scratch Org再現の前提と設定](../../../deployment/scratch-org-rebuild-reference.md)
- [Scratch Org manifest運用ルール](../../../deployment/scratch-org-manifest-rules.md)
- [Scratch Org definition featureルール](../../../deployment/scratch-org-definition-feature-rules.md)
- [テストデータ投入スクリプト](../test-data-import/index.md)

## テスト・確認観点

`scripts/scratch-org/test/*.node.js`で、alias、help、例外、step順序、失敗時停止、Salesforce CLI引数、設定参照、再構築manifestとGit管理sourceの整合を確認します。

```sh
node --test scripts/scratch-org/test/*.node.js
```

## 制約・注意事項

- setupはpackage installを実行しません。必要なpackageはmetadata反映前に個別にインストールします。
- setupはmetadata deploy前のdry-runを自動実行しません。再構築scopeを変更した場合は運用ルールに従って別途確認します。
- setupはDefault Target Orgを変更せず、作成時に確定したaliasを後続stepへ渡します。
- Scratch Orgは接続中のSalesforce組織と完全一致する環境ではありません。

## 既知の差異・確認事項

- 状態: 未確認
- Node.jsテストではSalesforce CLIと子プロセスを模擬しています。Scratch Orgの作成からデータ投入までの実動作は、対象Dev Hubのfeature、package、metadata、権限に依存します。
