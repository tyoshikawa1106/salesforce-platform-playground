# 取引先情報PDF

## 機能の用途

Lightning Experienceの取引先レコードページから、取引先の主要情報をA4縦のPDFとして新しいタブに表示します。LWCクイックアクションを操作入口とし、Visualforce PDFが帳票表示を担当します。

- 取引先の基本情報、住所、説明を1つの帳票として確認・共有する。
- ブラウザのPDF機能から利用者がダウンロードまたは印刷する。
- 取引先やSalesforce Filesへ新しいデータを保存せず、参照だけで帳票を生成する。

### 権限・実行条件

- Lightning Experienceの取引先レコードページで実行する。
- `LwcAccountPdfExport`によるVisualforce PageとApex Controllerへのアクセスが必要。
- `LwcAccountPdfExport` は取引先と出力対象項目の参照権限を付与する。対象レコードへの参照アクセスには共有設定が適用される。
- [AccountPdfController](../../../../force-app/main/default/classes/AccountPdfController.cls)と[AccountPdfSelector](../../../../force-app/main/default/classes/AccountPdfSelector.cls)は`with sharing`で実行する。
- SOQLは`WITH USER_MODE`を使用し、共有、CRUD、FLSを利用者権限で適用する。
- Business Accountを対象とする。Person Account固有の項目とラベルは扱わない。

## 対象メタデータ

診断情報の整形・重複した状態更新の抑止は内部APIモジュール[lwcLoggerUtils](../../../../force-app/main/default/lwc/lwcLoggerUtils/lwcLoggerUtils.js)を共用します。例外種別の判定、画面固有の案内・復旧操作、表示状態の保持は各画面で管理し、コンソールへ診断情報やAPI応答本文を出力しません。共通の安全化と記録条件は[対応テスト](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)で、各画面との接続は画面側のテストで確認します。

Apex本体と対応するテストクラス、補助LWC、共通部品の対応は[画面・帳票の構成一覧](../../screen-and-report-components.md)も参照してください。

### 画面・JavaScript

| 種別       | 実装・設定                                                                                                   | 役割                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| JavaScript | [accountPdfExport.js](../../../../force-app/main/default/lwc/accountPdfExport/accountPdfExport.js)           | 対象取引先IDを含むVisualforce URLの生成と新しいタブの起動 |
| JavaScript | [accountPdfExportLogic.js](../../../../force-app/main/default/lwc/accountPdfExport/accountPdfExportLogic.js) | 取引先ID判定とVisualforce PageReferenceの組み立て         |

### Apexコードと対応テスト

| Apex本体                                                                                    | 役割                                   | 対応するテストクラス                                                                                |
| ------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [AccountPdfController](../../../../force-app/main/default/classes/AccountPdfController.cls) | 取引先 PDF を表示する Visualforce 入口 | [AccountPdfControllerTest](../../../../force-app/main/default/classes/AccountPdfControllerTest.cls) |
| [AccountPdfSelector](../../../../force-app/main/default/classes/AccountPdfSelector.cls)     | 取引先 PDF の取引先問い合わせ          | [AccountPdfSelectorTest](../../../../force-app/main/default/classes/AccountPdfSelectorTest.cls)     |
| [AccountPdfService](../../../../force-app/main/default/classes/AccountPdfService.cls)       | 取引先 PDF の入力検証と表示値作成      | [AccountPdfServiceTest](../../../../force-app/main/default/classes/AccountPdfServiceTest.cls)       |
| [AccountPdfViewModel](../../../../force-app/main/default/classes/AccountPdfViewModel.cls)   | 取引先 PDF に表示する文字列            | [AccountPdfViewModelTest](../../../../force-app/main/default/classes/AccountPdfViewModelTest.cls)   |

テストデータの準備は、対応する対応するテストクラスの内部で管理します。

### 設定・権限

| 種別               | 実装・設定                                  | 役割                                                                                                                  |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| クイックアクション | PDF出力（`Account.PdfExport`）              | 「PDF出力」取引先クイックアクション                                                                                   |
| Visualforceページ  | 取引先情報PDF（`AccountPdf`）               | 取引先情報をPDFとしてレンダリングするVisualforce Page                                                                 |
| Layout             | `Account-Account Layout`                    | 「PDF出力」アクションを表示する標準取引先レイアウト                                                                   |
| Layout             | `Account-Account (Marketing) Layout`        | 「PDF出力」アクションを表示するマーケティング用取引先レイアウト                                                       |
| Layout             | `Account-Account (Sales) Layout`            | 「PDF出力」アクションを表示する営業用取引先レイアウト                                                                 |
| Layout             | `Account-Account (Support) Layout`          | 「PDF出力」アクションを表示するサポート用取引先レイアウト                                                             |
| 権限セット         | LWC：取引先PDF出力（`LwcAccountPdfExport`） | [AccountPdfController](../../../../force-app/main/default/classes/AccountPdfController.cls)と`AccountPdf`へのアクセス |

### 関連コンポーネント

- Salesforce標準のAccountオブジェクトとレコードページ
- ブラウザのPDF表示、ダウンロード、印刷機能
- [Issue #511](https://github.com/tyoshikawa1106/salesforce-platform-playground/issues/511): MVPの要求と完了条件

## アクセスするデータ・項目

取引先IDを条件に、利用者が参照できる取引先1件の基本情報、請求先住所、納入先住所、説明を取得します。

### 出力項目

| 区分     | 項目                                              |
| -------- | ------------------------------------------------- |
| 基本情報 | 取引先名、取引先番号、種別、業種、電話、Webサイト |
| 住所     | 請求先住所、納入先住所                            |
| 詳細     | 説明                                              |

説明と住所は入力改行を維持し、長い文字列を折り返します。説明はHTMLとして解釈せず、エスケープした文字列として表示します。長い説明は途中改ページを許可します。

- 出力: ブラウザの新しいタブに表示するPDF
- 更新: なし

Salesforce Files、取引先、その他のレコードへPDFや履歴を保存しません。

### SOQLで参照するデータ

```sql
SELECT Id, Name, AccountNumber, Type, Industry, Phone, Website, BillingPostalCode, BillingState, BillingCity, BillingStreet, BillingCountry, ShippingPostalCode, ShippingState, ShippingCity, ShippingStreet, ShippingCountry, Description
FROM Account
WHERE Id = :accountId
WITH USER_MODE
LIMIT 1
```

## 操作

取引先レコードの［PDF出力］を選ぶと、新しいタブに帳票が表示されます。

- クイックアクションが実行された取引先レコードID
- Visualforce URLパラメーターの`accountId`

`accountId`はApex側でもID形式と`Account`のSObject種別を検証します。任意の項目名やSOQL条件は受け取りません。

## エラー判定

起動LWCの`accountPdfExport`は自身のControllerで例外を捕捉し、`accountPdfExportLogic.js`で診断情報を生成します。画面を持たないため処理場所・例外種別はエラー時のトーストに含め、成功ログは生成しません。

- LWCが取引先IDを受け取れない場合、元のLightning画面へエラーToastを表示する。
- URL生成または新しいタブの起動処理で例外が発生した場合、元のLightning画面へ再試行を案内するエラーToastを表示する。
- URLパラメーターが未指定、不正形式、または取引先以外の場合、Visualforce PDFに安全な入力エラーを表示する。
- 取引先が存在しない場合と権限で参照できない場合は区別せず、参照権限の確認を案内する。
- 想定外のApex例外は詳細を表示せず、時間をおいて再試行する文言へ置き換える。

## 処理詳細

1. 「PDF出力」ヘッドレスクイックアクションが取引先レコードIDを受け取る。
2. LWCがNavigation Serviceで`/apex/AccountPdf?accountId=<取引先ID>`のURLを生成する。
3. LWCが生成URLを新しいタブで開く。同じアクションの処理中は二重実行しない。
4. [AccountPdfController](../../../../force-app/main/default/classes/AccountPdfController.cls)がURLパラメーターを検証する。
5. [AccountPdfSelector](../../../../force-app/main/default/classes/AccountPdfSelector.cls)が共有、CRUD、FLSを含む利用者権限で取引先を取得する。
6. [AccountPdfService](../../../../force-app/main/default/classes/AccountPdfService.cls)が空項目を`―`へ統一し、住所を複数行の表示文字列へ変換する。
7. Visualforceが基本情報、住所、詳細をPDFとして表示する。

### 制約・注意事項

- PDFはA4縦で、Visualforce PDFレンダリングサービスが対応するCSSだけを使用する。
- 日本語などのマルチバイト文字は`Arial Unicode MS`を使用する。外部Webフォントは使用しない。
- PDFはURLに取引先IDを含むため、ブラウザ履歴にIDが残る。
- ブラウザのポップアップ設定により、新しいタブが抑止される場合がある。
- Experience CloudとSalesforceモバイルは対象外。
- `PageReference.getContentAsPDF()`、Salesforce Filesへの保存、メール添付、一括生成は対象外。

### 既知の差異・確認事項

- 差異なし: Issue #511で定義されたMVPの出力項目、別タブ表示、データ非保存、責務分離を実装する。
- 未確認: Person Accountが有効な別orgでの表示。リポジトリのScratch Org設定ではPerson Accountを有効化していないため、Business Accountのみを対象とする。

### テストコード

[テストコードと確認内容](tests.md)
