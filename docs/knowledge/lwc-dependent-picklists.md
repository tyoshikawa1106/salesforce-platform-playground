# LWC で組織の設定に合わせて連動選択リストを表示する

2026年11月25日に、ユーザー作成アシスタントの実装と Scratch Org で確認した内容です。コピー元と新規ユーザーを左右に表示するフォームを例に、制御項目を変えた側だけで選択候補を切り替える方法を説明します。

## 制御項目と候補の対応を取得する

Apex では、各 User 項目の `Schema.DescribeFieldResult.getController()` から、その項目を制御する項目を取得します。制御項目があれば `getDescribe().getName()` で API 名を取り出し、従属項目の定義に `controllerName` として添えます。これで、組織に追加されたカスタム項目についても、画面がどの項目の変更を見ればよいか分かります。[Apex の項目定義生成](../../force-app/main/default/classes/UserCreateAssistantService.cls)

LWC は連動項目がある場合に `getPicklistValuesByRecordType` を使い、User のマスターレコードタイプに対する選択肢をまとめて取得します。別のオブジェクトで使う場合は、対象レコードに適用するレコードタイプを指定します。[LWC の取得処理](../../force-app/main/default/lwc/userCreateAssistant/userCreateAssistant.js)・[Salesforce のワイヤアダプター仕様](https://developer.salesforce.com/docs/platform/lwc/guide/reference-wire-adapters-picklist-values-record.html)

## 制御値から選べる候補を求める

UI API の応答では、従属項目ごとに `controllerValues` が制御値の API 値と番号を対応付けています。各候補の `validFor` は、その候補を選べる番号の配列です。画面に表示する名前には候補の `label`、入力値の比較や保存には `value` を使います。[Salesforce の連動選択リストの解説](https://developer.salesforce.com/docs/platform/user-interface/guide/ui-api-features-records-dependent-picklist.html)

```js
const dependency = data.picklistFieldValues[dependentFieldName];
const index = dependency.controllerValues[String(controllerValue)];
const choices = dependency.values.filter((option) => option.validFor.includes(index));
```

たとえば Scratch Org では、制御項目 `QaPick__c` の `Green` が番号 `0`、`Blue` が番号 `1` でした。従属する複数選択項目 `QaMulti__c` の Green は `validFor: [0]`、Blue は `validFor: [1]` です。制御値が Green なら Green が候補になります。番号はその従属項目の応答から引き、`0` も有効な番号として扱います。

## 左右の入力と既存値を扱う

対応表は両側で共有します。左側はコピー元の保存値を起点に、その側で編集した制御値を優先します。右側はコピー時の初期値を含む新規ユーザーの入力値を使います。制御項目を変更したときは、変更した側の値で候補を絞り直します。候補を切り替えるたびに Salesforce に問い合わせる必要はありません。[左右の候補を組み立てる処理](../../force-app/main/default/lwc/userCreateAssistant/userCreateAssistantLogic.js)

Scratch Org の検証用設定では、新規側の複数選択に Green と Blue が入った状態で、制御値を切り替えて次の表示を確認しました。

| 新規側の制御値 | 選べる候補 | 選択済みで対象外になった値 |
| -------------- | ---------- | -------------------------- |
| Green          | Green      | Blue（選択対象外）         |
| Blue           | Blue       | Green（選択対象外）        |

この画面では、コピー元の参照欄には過去の保存値も表示します。新規側に候補外の値が残っている場合は、その値を見える状態に保ち、選び直すか解除するまで確認画面に進めないようにしています。これにより、利用者はどの値が引き継げないかを保存前に判断できます。[画面の回帰テスト](../../force-app/main/default/lwc/userCreateAssistant/__tests__/userCreateAssistant.test.js)・[ユーザー作成アシスタントの機能仕様](../specifications/lwc/user-create-assistant/index.md)
