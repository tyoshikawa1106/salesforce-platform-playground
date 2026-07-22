# 取引先情報PDF

## 概要

Lightning Experienceの取引先レコードページから、取引先の主要情報をA4縦のPDFとして新しいタブに表示します。LWCクイックアクションを操作入口とし、Visualforce PDFが帳票表示を担当します。

## 目的・利用場面

- 取引先の基本情報、住所、説明を1つの帳票として確認・共有する。
- ブラウザのPDF機能から利用者がダウンロードまたは印刷する。
- 取引先やSalesforce Filesへ新しいデータを保存せず、参照だけで帳票を生成する。

## 対象実装・メタデータ

### 入口・画面

- `Account.PdfExport`: 「PDF出力」取引先クイックアクション
- `accountPdfExport.js`: 対象取引先IDを含むVisualforce URLの生成と新しいタブの起動
- `accountPdfExportLogic.js`: 取引先ID判定とVisualforce PageReferenceの組み立て
- `AccountPdf`: 取引先情報をPDFとしてレンダリングするVisualforce Page
- `Account-Account Layout`: 「PDF出力」アクションを表示する標準取引先レイアウト
- `Account-Account (Marketing) Layout`: 「PDF出力」アクションを表示するマーケティング用取引先レイアウト
- `Account-Account (Sales) Layout`: 「PDF出力」アクションを表示する営業用取引先レイアウト
- `Account-Account (Support) Layout`: 「PDF出力」アクションを表示するサポート用取引先レイアウト

### Apex

- `AccountPdfController`: Visualforceからの入力受付と処理順序の制御
- `AccountPdfService`: 取引先ID検証、空値、住所、表示文字列の組み立て
- `AccountPdfSelector`: 利用者権限による取引先情報の取得
- `AccountPdfViewModel`: Visualforceへ公開する表示文字列

### 設定・権限

- `Salesforce_Application_User`: `AccountPdfController`と`AccountPdf`へのアクセス

## 入力

- クイックアクションが実行された取引先レコードID
- Visualforce URL parameterの`accountId`

`accountId`はApex側でもID形式と`Account`のSObject種別を検証します。任意の項目名やSOQL条件は受け取りません。

## 処理内容

1. 「PDF出力」ヘッドレスクイックアクションが取引先レコードIDを受け取る。
2. LWCがNavigation Serviceで`/apex/AccountPdf?accountId=<取引先ID>`のURLを生成する。
3. LWCが生成URLを新しいタブで開く。同じアクションの処理中は二重実行しない。
4. `AccountPdfController`がURL parameterを検証する。
5. `AccountPdfSelector`が共有、CRUD、FLSを含む利用者権限で取引先を取得する。
6. `AccountPdfService`が空項目を`―`へ統一し、住所を複数行の表示文字列へ変換する。
7. Visualforceが基本情報、住所、詳細をPDFとして表示する。

### 出力項目

| 区分     | 項目                                              |
| -------- | ------------------------------------------------- |
| 基本情報 | 取引先名、取引先番号、種別、業種、電話、Webサイト |
| 住所     | 請求先住所、納入先住所                            |
| 詳細     | 説明                                              |

説明と住所は入力改行を維持し、長い文字列を折り返します。説明はHTMLとして解釈せず、エスケープした文字列として表示します。長い説明は途中改ページを許可します。

## 出力・更新対象

- 出力: ブラウザの新しいタブに表示するPDF
- 更新: なし

Salesforce Files、取引先、その他のレコードへPDFや履歴を保存しません。

## 権限・実行条件

- Lightning Experienceの取引先レコードページで実行する。
- `Salesforce_Application_User`によるVisualforce PageとApex Controllerへのアクセスが必要。
- 対象取引先の参照権限と、全出力項目の項目参照権限が必要。
- `AccountPdfController`と`AccountPdfSelector`は`with sharing`で実行する。
- SOQLは`WITH USER_MODE`を使用し、共有、CRUD、FLSを利用者権限で適用する。
- Business Accountを対象とする。Person Account固有の項目とラベルは扱わない。

## エラー処理

- LWCが取引先IDを受け取れない場合、元のLightning画面へエラーToastを表示する。
- URL生成または新しいタブの起動処理で例外が発生した場合、元のLightning画面へ再試行を案内するエラーToastを表示する。
- URL parameterが未指定、不正形式、または取引先以外の場合、Visualforce PDFに安全な入力エラーを表示する。
- 取引先が存在しない場合と権限で参照できない場合は区別せず、参照権限の確認を案内する。
- 想定外のApex例外は詳細を表示せず、時間をおいて再試行する文言へ置き換える。

## 関連コンポーネント

- Salesforce標準のAccountオブジェクトとレコードページ
- ブラウザのPDF表示、ダウンロード、印刷機能
- [Issue #511](https://github.com/tyoshikawa1106/salesforce-platform-playground/issues/511): MVPの要求と完了条件

## テスト・確認観点

- `AccountPdfControllerTest`: 正常な取引先、parameter未指定、不正ID、別SObject ID、不存在レコード、安全なエラー
- `AccountPdfServiceTest`: ID検証、空項目、住所改行、日本語、HTMLに見える文字列、説明の複数行
- `AccountPdfSelectorTest`: 利用者権限による出力項目取得、null、不存在レコード
- `AccountPdfViewModelTest`: 空項目の代替表示
- `accountPdfExport.test.js`: URL生成、新しいタブ、IDエラー、二重実行防止、起動失敗Toast
- `accountPdfExportLogic.test.js`: 15桁・18桁の取引先ID判定とVisualforce URL encoding
- 接続org: Lightningからの起動、日本語、空項目、長いURL、複数行と空行、改ページ、権限不足、PDFの表示・ダウンロード・印刷

## 制約・注意事項

- PDFはA4縦で、Visualforce PDFレンダリングサービスが対応するCSSだけを使用する。
- 日本語などのマルチバイト文字は`Arial Unicode MS`を使用する。外部Webフォントは使用しない。
- PDFはURLに取引先IDを含むため、ブラウザ履歴にIDが残る。
- ブラウザのポップアップ設定により、新しいタブが抑止される場合がある。
- Experience CloudとSalesforceモバイルは対象外。
- `PageReference.getContentAsPDF()`、Salesforce Filesへの保存、メール添付、一括生成は対象外。

## 既知の差異・確認事項

- 差異なし: Issue #511で定義されたMVPの出力項目、別タブ表示、データ非保存、責務分離を実装する。
- 未確認: Person Accountが有効な別orgでの表示。リポジトリのScratch Org設定ではPerson Accountを有効化していないため、Business Accountのみを対象とする。
