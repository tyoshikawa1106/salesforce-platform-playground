# テストデータ投入スクリプト

## 概要

リポジトリ管理のimport planに従ってanonymous Apexを組み立て、承認されたDefault Target Orgへ合成テストデータを順番に投入するNode.jsスクリプトです。組織へ接続しないdry-runも提供します。

## 目的・利用場面

画面、Flow、Triggerなどを組織上で確認するための合成テストデータを、再現可能な順序と件数で準備するときに使用します。

## 対象実装・メタデータ

| 種別             | パス                                                | 役割                                           |
| ---------------- | --------------------------------------------------- | ---------------------------------------------- |
| npm script       | `setup:data:dry-run`、`setup:data`                  | dry-runと実投入の利用者向け入口                |
| Node.js script   | `scripts/setup/import-test-data.js`                 | 引数、組織確認、承認、実行開始を制御する       |
| Node.js module   | `scripts/setup/internal/import-test-data-core.js`   | plan、パス、Apex合成、CLI引数を検証する        |
| Node.js module   | `scripts/setup/internal/import-test-data-runner.js` | entryの実行、表示、一時ファイル削除を行う      |
| import plan      | `scripts/setup/plans/import-test-data-plan.json`    | entry、順序、preamble、繰り返し回数を定義する  |
| Apex source      | `scripts/apex/test-data/`                           | 合成または単独実行するanonymous Apexを格納する |
| テストスクリプト | `scripts/setup/test/*.node.js`                      | 引数、plan、組織制御、実行、後始末を検証する   |

## 入力

| オプション             | 用途                                           |
| ---------------------- | ---------------------------------------------- |
| `--plan <path>`        | リポジトリ内のimport planを指定する            |
| `--only <label>`       | 完全一致する1つのentryだけを選択する           |
| `--default-repeat <n>` | entry固有値がない場合の繰り返し回数を指定する  |
| `--repeat <n>`         | 選択したentryの繰り返し回数を上書きする        |
| `--dry-run`            | 組織へ接続せずローカル検証と予定表示だけを行う |
| `--help`、`-h`         | 使用方法を表示する                             |

利用者がTarget Orgを引数で指定することはできません。通常実行はDefault Target Orgを使用し、Scratch Org準備処理だけが作成済みaliasを内部的に引き渡します。

## 処理内容

1. 引数を解析し、未知の引数、値不足、正の整数でない繰り返し回数を拒否する。
2. planと参照Apexのパスをリポジトリ内へ限定し、entry、label、operation、ファイル内容を検証する。
3. `standalone: true`のentryは単独ファイル、それ以外は共通preambleとentry固有ファイルを結合する。
4. dry-runでは組織情報と確認入力を使用せず、sourceと実行予定の`sf apex run`を表示する。
5. 実投入では対象組織を特定して情報を表示し、本番環境を承認前に拒否する。
6. Sandbox、Scratch Org、Developer Editionでは、`この接続組織で続行しますか？ [y/N]:`に`y`または`Y`が入力された場合だけ続行する。
7. 合成済みApexを実行ごとの一時ディレクトリへ書き出し、plan順と繰り返し回数に従って`sf apex run`を同期実行する。
8. debug logから実行キー、作成、削除、スキップの集計行を表示する。
9. 成功、失敗のどちらでも、この実行が作成した一時ディレクトリを削除する。

## 出力・更新対象

- dry-runはローカルとSalesforce組織を変更しません。
- 実投入はplan内のanonymous Apexが対象組織のレコードを作成、更新、削除する場合があります。
- 実行対象、合成元source、Salesforce CLIコマンド、seed集計を標準出力へ表示します。
- 一時Apexファイルは処理後に残しません。

## 権限・実行条件

- Node.jsとSalesforce CLIを利用できる必要があります。
- 実投入では対象組織が認証済みで、Sandbox、Scratch Org、Developer Editionのいずれかと判定できる必要があります。
- 実行ユーザーにはanonymous Apexの実行権限と、対象レコードへの必要な権限が必要です。
- 本番環境では実行できません。

## エラー処理

- planまたはApexの問題は組織確認前に停止します。
- Default Target Org未設定、組織の一意特定失敗、種別不明では確認入力を開始しません。
- 承認拒否はテストデータを投入せず終了コード`0`で終了します。
- Salesforce CLIの起動またはentry実行が失敗した場合は元の出力を表示し、残りの繰り返しとentryを実行せず終了コード`1`を返します。
- 後続entryで失敗しても、それ以前に組織へ反映されたレコードは自動でロールバックしません。

## 関連コンポーネント

- [テストデータ投入手順](../../../deployment/test-data-import.md)
- [Scratch Org管理スクリプト](../scratch-org-management/index.md)
- `scripts/soql/test-data-check-queries/`

## テスト・確認観点

`scripts/setup/test/*.node.js`で、引数、リポジトリ外パス拒否、planとApex構成、dry-run、対象組織、承認、本番禁止、CLI失敗、一時ファイル削除を確認します。

```sh
node --test scripts/setup/test/*.node.js
```

## 制約・注意事項

- dry-runはローカル構成と実行予定を確認するもので、Salesforce組織上の権限、入力規則、Trigger、Flowの成否を検証しません。
- 複数entryをまたぐトランザクションではありません。途中失敗時は投入済みレコードを確認してから再実行します。
- planとApexは合成テストデータだけを扱い、実在する個人情報や顧客情報を含めません。
- 実行件数と再実行時の削除、スキップ条件は各Apex sourceの実装に従います。

## 既知の差異・確認事項

- 状態: 未確認
- Node.jsテストではSalesforce CLIと組織情報を模擬しています。組織機能や権限に依存するoptional objectの作成可否は、対象組織で実行した集計と確認SOQLから判断します。
