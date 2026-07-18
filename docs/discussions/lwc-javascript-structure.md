# LWC JavaScript 構成

## 位置づけ

この文書は、画面 LWC の JavaScript が大きくなり、処理の流れを追いにくくなる課題に対して、メイン JavaScript とロジック用 JavaScript の責務を検討した判断過程をまとめたものです。

決定した実務ルールは [AI エージェント開発ルール](../development/agent-development-rules.md#javascript-構成) を正とします。

## 背景

画面 LWC では、wire、イベント処理、画面状態、データ変換、表示判定、Apex リクエスト生成などを、コンポーネント名と同じメイン JavaScript にまとめられます。

処理が増えても 1 ファイルで実装を継続できる一方、次の問題が生じます。

- 画面操作から結果表示までの処理順序を追いにくい。
- LWC 固有処理と、独立して検証できる変換・判定が混在する。
- 1つの変更で確認する範囲が広くなる。
- 細かいロジックをテストするために、コンポーネント全体のレンダリングや mock が必要になる。

Apex では、Controller で処理の流れを確認し、詳細を Service や Selector で確認できるように責務を分けています。LWC でも同じ読み方をできる構成が必要です。ただし、クライアント側で Service と Selector を分ける必要はなく、最初はロジック用 JavaScript 1つで十分と判断しました。

## 確認した現行実装

`objectRecordSearch` は、メイン JavaScript から同一 bundle の `objectRecordSearchDisplay.js`、`objectRecordSearchState.js`、`objectRecordSearchForm.js` を相対 import しています。分離した変換や状態遷移は、専用の Jest test から直接確認しています。

この構成から、同一 bundle 内の追加 JavaScript へ処理を分け、メイン JavaScript から相対 import する方法が、このリポジトリですでに利用できることを確認しました。

一方で、メイン JavaScript には多数の getter、wire、イベント処理、フォーム操作、状態更新が残っています。ほかの画面 LWC には、表示値生成や状態管理をメイン JavaScript だけで行っているものもあります。そのため、追加 JavaScript の有無を個別判断にすると、コンポーネントごとに構成と読み方が分かれる課題が残ります。

現在の JavaScript コメント規約では、意味を持つコード行へ短い日本語コメントを付けます。これは行数と視覚的な情報量を増やすため、責務境界を明確にする必要性を高めます。コメント規約自体の変更は、この構成判断とは分離して検討します。

## Aura Helper との違い

Aura では、フレームワークが Controller と Helper を bundle の構成要素として扱い、Controller から Helper を呼び出します。

LWC に Aura と同じ専用 Helper はありません。LWC は ES Modules を使い、同じコンポーネントフォルダの追加 JavaScript が export した関数や値を、メイン JavaScript から相対 import します。

Salesforce 公式ドキュメントでも、UI コンポーネント内のコードを構造化するために追加 JavaScript を置く方法と、複数コンポーネントでコードを共有する API module の方法が案内されています。

- [Additional JavaScript Files](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-javascript-share.html)
- [Share JavaScript Code](https://developer.salesforce.com/docs/platform/lwc/guide/js-share-code)

Aura Helper に近い目的を持ちますが、コンポーネントインスタンスを渡して操作するのではなく、通常の ES Modules と純粋関数を使う点が異なります。

## 採用する構成

独自実装する画面 LWC は、次の 2 層を必須とします。

```text
componentName/
├── componentName.html
├── componentName.js
├── componentNameLogic.js
├── componentName.css
└── componentName.js-meta.xml
```

CSS が不要なコンポーネントでは、`componentName.css` は必須ではありません。

### メイン JavaScript

`componentName.js` は Apex の Controller に近い入口として、次を担当します。

- `@api`、`@wire`、ライフサイクル。
- テンプレートから受け付けるイベント。
- wire adapter、imperative Apex、Toast、Navigation、`refreshApex`、DOM 操作。
- 非同期処理の順序と、成功・失敗時の大きな分岐。
- Logic が返した結果の画面状態への反映。

メイン JavaScript を読めば、利用者の操作から結果表示までの主要な流れを確認できる状態にします。

### ロジック用 JavaScript

`componentNameLogic.js` は、次のような UI ロジックを担当します。

- データ変換と表示値生成。
- 入力値の検証と正規化。
- 表示条件や操作可否の判定。
- Apex などへ渡すリクエストの生成。
- 状態遷移の計算。
- エラー情報の表示用変換。

Logic は必要な値だけを受け取り、結果を返す純粋関数を基本とします。`this`、コンポーネントインスタンス、DOM 要素は受け取りません。

## 現行 LWC への当てはめ

### caseContactProfile

`caseContactProfile` は、wire、Navigation、画面状態への反映に加えて、Contact と Account の表示値生成、代替項目の選択、件数表示、状態リセットの判定をメイン JavaScript で行っています。

2 層構成へ合わせる場合は、wire、Navigation、UI API からの値取得、成功・失敗時の状態反映を `caseContactProfile.js` に残します。表示値、フォールバック、件数表示、リセット後の状態生成を `caseContactProfileLogic.js` へ分離します。

### objectRecordSearch

`objectRecordSearch` は、Display、State、Form、FormPolicy の責務別 JavaScript があり、変換や状態遷移をメイン JavaScript から分離しています。

2 層構成へ合わせるときは、既存ファイルを残す前提にせず、各処理の責務と依存関係を再評価します。小さく密接な処理は `objectRecordSearchLogic.js` へ統合し、Display、State、Form のように独立した責務として処理を追いやすく、直接テストする価値がある処理だけを追加 JavaScript として分割します。

追加分割が必要と判断した場合は、次の依存方向にします。

```text
objectRecordSearch.js
    -> objectRecordSearchLogic.js
        -> objectRecordSearchDisplay.js
        -> objectRecordSearchState.js
        -> objectRecordSearchForm.js
            -> objectRecordSearchFormPolicy.js
```

`objectRecordSearchLogic.js` は単なる再 export ではなく、検索リクエスト、検索結果、フォーム表示、ページ移動後の状態など、画面単位のまとまった結果を生成します。追加分割したモジュールは、その処理から利用する詳細モジュールとして扱います。

この形により、メイン JavaScript では検索、成功・失敗、状態反映の流れを確認し、Logic では画面単位の状態生成を確認し、追加分割したモジュールでは列変換やページトークン計算などの詳細を確認できます。

## 必須化する理由

Logic を任意にすると、処理量が同程度でも、メイン JavaScript だけで実装する LWC と追加 JavaScript へ分ける LWC が混在します。「単純な LWC なら省略できる」とすると、単純かどうかの判断が開発者ごとに分かれます。

2 層構成を必須にすることで、どの画面 LWC でも次の順序で確認できます。

1. メイン JavaScript で処理の入口、順序、状態反映を確認する。
2. Logic で変換、判定、状態遷移の詳細を確認する。
3. Logic の Jest test で細かい条件を確認する。
4. コンポーネントの Jest test で DOM、イベント、Logic との接続を確認する。

Logic が小さいことは問題にしません。構成を統一し、処理が増えたときの置き場を最初から明確にすることを優先します。

## 懸念と対策

### 形式だけの分割

Logic の作成自体が目的になると、単純な代入や呼び出しを移しただけの関数が増え、確認するファイルだけが増えます。

メイン JavaScript には処理の大枠を残し、Logic には独立して検証する意味のある変換、判定、正規化、状態遷移を置きます。メイン JavaScript から Logic を呼ぶだけの多段ラッパーは作りません。

### Logic の巨大化

すべての詳細処理を 1 つの Logic へ移すと、メイン JavaScript の問題が移動しただけになります。

最初は `componentNameLogic.js` にまとめ、複数の独立した責務が明確になった場合だけ追加 JavaScript へ分割します。追加分割後も、`componentNameLogic.js` をメイン JavaScript から参照するロジックの入口にします。

既存ファイルの有無は分割理由にしません。責務と依存関係を再評価し、密接な処理は Logic へ統合し、独立した責務だけを追加分割します。

### 処理フローの隠蔽

条件分岐や非同期処理の順序まで Logic へ隠すと、メイン JavaScript を読んでも画面処理を理解できません。

利用者操作、非同期処理、成功・失敗、状態反映の大枠はメイン JavaScript に残します。Logic は、その流れで必要になる値や次の状態を計算します。

### LWCとの密結合

Logic へコンポーネントインスタンスを渡すと、Aura Helper に近い密結合になり、単独テストが難しくなります。

Logic は必要な値だけを引数で受け取り、結果を返します。LWC 固有 API や DOM へ直接依存させず、メイン JavaScript との循環 import も作りません。

### 業務ルールの流出

権限、データ整合性、業務上必須の制約を LWC だけで実装すると、Apex、Flow、API など別経路の更新で回避されます。

Logic が担当するのは画面状態、表示値、入力の正規化、リクエスト生成などの UI ロジックです。更新経路にかかわらず守る必要があるルールは、Apex または Salesforce メタデータ側で担保します。

### 既存 LWC への適用

ルール追加と同時に既存 LWC を一括変更すると、機能変更を伴わない大きな差分が生じます。

新規 LWC には最初から適用し、既存 LWC は振る舞いを変更するときに bundle 全体を 2 層構成へ合わせます。構成だけを合わせる一括リファクタリングは、対象と検証範囲を明示した別タスクとして扱います。

## 対象外

次は画面 LWC の Controller と Logic という役割を持たないため、2 層構成の対象外とします。

- 複数コンポーネントへ関数を公開する API module。
- CSS だけを公開する CSS module。
- Jest test 用の mock。
- インストール済み・生成済みコンポーネント。

対象外を「単純な LWC」に広げません。処理量による例外を設けると、構成判断のばらつきが再発するためです。
