# テストデータ投入手順

Salesforce CLI で、リポジトリ管理された合成テストデータを org に投入する手順です。

スクリプトの現在の入力、処理順、停止条件、出力は[テストデータ投入スクリプト仕様](../specifications/scripts/test-data-import/index.md)を参照してください。

## 使い分け

この仕組みは、画面操作や Flow / Trigger の動作確認など、org 上に一時的なテストレコードが必要な場合に使います。

Apex テストでは、組織内データに依存せず、テスト内で `TestDataFactory` などを使ってデータを作成します。

## ファイル構成

`scripts/` 全体の配置方針は `scripts/scripts-guide.md` を参照します。`scripts/setup/` は初期セットアップの実行起点とplanを置く場所です。匿名Apexのシード用スクリプトは、ファイル種別に合わせて`scripts/apex/`に置きます。

- `scripts/setup/plans/import-test-data-plan.json`: 主要標準オブジェクト seed の実行計画と共通preamble。
- `scripts/apex/test-data/seed-standard-preamble.apexpart`: 標準オブジェクトseedで共有する変数と関数の断片。
- `scripts/apex/test-data/seed-standard-*.apexpart`: 標準オブジェクトseedのobject固有処理の断片。
- `scripts/apex/test-data/*.apex`: 単独で実行するanonymous Apex。
- `scripts/soql/test-data-check-queries/*.soql`: 初期データ投入後の横断確認用 SOQL。
- `scripts/soql/object-queries/<object>/*.soql`: オブジェクトごとの調査・運用確認用 SOQL。
- `scripts/setup/import-test-data.js`: import planを読み、共通preambleとobject固有処理を一時ファイルへ合成して`sf apex run`を順番に実行する。

## 事前確認

実投入では、最初にimport planと参照するApexファイルをローカルで検証します。構成に問題がある場合は、Salesforce組織を確認せずに停止します。

ローカル検証後は、現在のdefault target orgだけを対象にします。スクリプトはSalesforce CLIの認証済み組織情報から、default target orgのalias、ユーザー名、URL、種別を表示します。利用者が別のTarget Orgを引数で指定することはできません。

Scratch Orgセットアップでは、作成処理が確定したaliasを内部的に引き継ぎます。default target orgを変更せず、通常の投入コマンドとも混在させません。

Sandbox、Scratch Org、Developer Editionでは、表示された接続組織を`y`または`Y`で承認した場合だけ実投入へ進みます。本番環境へのテストデータ投入は禁止し、接続組織の情報を表示した後、承認を求めずにエラー終了します。対象組織を一意に特定できない場合や、組織種別を判定できない場合も実投入しません。

報告には対象 org alias を書き、実ユーザー名や org 固有 URL は書きません。

## dry-run

実行前に、ローカルファイルと実行予定コマンドを確認します。

dry-runは組織へ接続せず、接続組織の表示と入力確認も行いません。

```sh
npm run setup:data:dry-run
```

## 主要標準オブジェクト seed

### 実行単位

主要標準オブジェクトは親子関係や価格表 ID を必要とするため、CSV の一括投入ではなく、Salesforce CLI から anonymous Apex を実行します。

execute anonymousのCPU／サイズ制限を避けるため、1つのprimary objectにつき1つのobject固有ファイルへ分け、`scripts/setup/plans/import-test-data-plan.json`の順序で実行します。各実行では`seed-standard-preamble.apexpart`とobject固有の`.apexpart`を一時的な`.apex`ファイルへ合成し、終了後に一時ファイルを削除します。`standalone: true`のentryは共通preambleを使わず、単独実行可能な`.apex`を使用します。

実投入が成功すると、anonymous Apexのdebug logから実行キー、作成件数、削除件数、スキップ件数の集計行を表示します。Salesforce CLIが失敗した場合は元の標準出力と標準エラーを表示し、残りのplan entryを実行せずに停止します。

件数や固定マスタの扱いは、このセクションの作成対象一覧の後にまとめます。

```sh
npm run setup:data:dry-run
npm run setup:data
```

一部だけ投入する場合は、`import-test-data-plan.json`の`label`を指定します。

```sh
npm run setup:data -- --only standard-objects-accounts
```

### ケースメールログ表示用データ

`caseEmailMessageList` のページングと長文・短文の表示を確認するため、基準となる合成ケースへメールを作成します。対象ケースと生成内容は[メール用seed](../../scripts/apex/test-data/seed-case-email-message-list.apex)を参照してください。

再実行時は、件名が「`[TEST-LWC-BULK]`」で始まる専用データだけを削除し、seedの定義に従って再作成します。それ以外の既存メールは残します。

```sh
npm run setup:data:dry-run -- --only case-email-message-list
npm run setup:data -- --only case-email-message-list
```

画面では「次のメールを読み込む」を選択し、取得したメールが末尾へ追加されて古い順を維持することと、長文・短文を表示できることを確認します。表示上限などの仕様は[ケースメールログ表示](../specifications/lwc/case-email-message-list/index.md)を参照してください。

### 最近の問い合わせ表示用データ

`caseRelatedCaseList`の顧客タブと会社タブを確認するため、基準となる合成ケースと同じContact、Accountへ関連ケースを作成します。対象ケースと生成内容は[関連ケース用seed](../../scripts/apex/test-data/seed-case-related-case-list.apex)を参照してください。

再実行時は、件名が「`[TEST-LWC-RELATED]`」で始まる専用データだけを削除し、seedの定義に従って再作成します。それ以外の既存ケースは残します。

```sh
npm run setup:data:dry-run -- --only case-related-case-list
npm run setup:data -- --only case-related-case-list
```

画面では「顧客」と「会社」の両タブに表示中Caseがリンクなしで含まれ、関連ケースと合わせて作成日時の降順で表示されることを確認します。表示中Caseは先頭に固定しません。表示上限などの仕様は[最近の問い合わせ仕様](../specifications/lwc/case-related-case-list/index.md)を参照してください。

投入後の主要レコードは、確認用 SOQL で確認できます。

```sh
sf data query --file scripts/soql/test-data-check-queries/accounts.soql --target-org <alias>
sf data query --file scripts/soql/test-data-check-queries/opportunities.soql --target-org <alias>
sf data query --file scripts/soql/test-data-check-queries/cases.soql --target-org <alias>
```

オブジェクトごとの調査クエリ例は、`scripts/soql/object-queries/account/`、`scripts/soql/object-queries/opportunity/`、`scripts/soql/object-queries/case/` に置きます。

### 作成対象

作成対象と依存順序は[import plan](../../scripts/setup/plans/import-test-data-plan.json)、各データの内容はplanが参照するApex sourceを正とします。投入前にdry-runで対象を確認し、投入後は実行結果の作成・削除・スキップ集計を確認します。

### 生成方針

- 生成量はseedとplanの繰り返し設定に従う。Scratch Org向けの繰り返し設定は[投入step](../../scripts/scratch-org/steps/import-test-data.js)で管理する。
- 組織の機能や権限で作成できないoptional objectは、debug logに理由を出し、作成可能な範囲を続行する。
- 商品価格はカスタム価格表を作成せず、標準価格表を有効化して`PricebookEntry`を作成する。
- 画面で識別できる合成名称を使用する。テストデータの識別条件は各seedで確認する。
- 請求先・納入先住所の都道府県は`State`で設定し、State/Country Picklistの有無に依存しないようにする。
- `Name`、`LastName`、`Subject`、`Title`など画面に表示される主要名称には連番プレフィックスを付けない。内部識別が必要な値は、メール、URL、外部識別用フィールド、ファイルパスなどに保持する。

### 作成しない対象

`Knowledge`, `Report`, `Dashboard`, `User` は画面上の集計対象に含まれていても、この DML seed では作成しません。Knowledge article sObject は org の機能状態に依存し、Report / Dashboard は metadata-backed、追加 User はライセンスとプロファイル設計が必要なためです。

## データ追加時の注意

- 実在の個人情報、顧客情報、秘密情報を入れない。
- org 固有の ID を固定しない。
- validation rule、required field、picklist 値を describe で確認する。
- 親子関係のあるデータは親から投入する。
- Trigger / Flow の bulk 動作を見たい場合は、200 件境界を超える件数を用意する。
- データ投入は metadata deploy ではないため、投入したレコードを Git 差分や manifest に含めない。
