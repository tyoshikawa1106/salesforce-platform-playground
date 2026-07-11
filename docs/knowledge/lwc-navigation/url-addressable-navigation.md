# URL addressable component の設計

[LWC の画面遷移](../lwc-navigation.md)に戻る。

## LWC 自体を URL で開けるようにする

### meta XML

独立した LWC 画面として開きたい場合は、対象 LWC の meta XML に `lightning__UrlAddressable` を追加します。

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle>
    <apiVersion>67.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__UrlAddressable</target>
    </targets>
</LightningComponentBundle>
```

実ファイルでは、既存の LWC meta XML と同じ namespace を使います。

### 遷移側

遷移側は `standard__component` を使います。

```js
this[NavigationMixin.Navigate]({
    type: 'standard__component',
    attributes: {
        componentName: 'c__objectRecordSearch'
    },
    state: {
        c__metricKey: 'accounts'
    }
});
```

URL は次のような形式になります。

```text
/lightning/cmp/c__objectRecordSearch?c__metricKey=accounts
```

`state` に渡すキーは名前空間付きにします。名前空間がない組織では `c__` を使います。値は文字列として扱います。

### 受け取り側

受け取り側は `CurrentPageReference` で URL state を読みます。

```js
import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';

export default class ObjectRecordSearch extends LightningElement {
    metricKey;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        this.metricKey = pageReference?.state?.c__metricKey;
    }
}
```

`CurrentPageReference` の値は URL が変わるたびに再評価されます。URL パラメータを UI 状態として使う場合は、setter 内で文字列を正規化してから内部 state に入れると扱いやすくなります。

```js
@wire(CurrentPageReference)
setCurrentPageReference(pageReference) {
    const metricKey = pageReference?.state?.c__metricKey;
    this.metricKey = typeof metricKey === 'string' ? metricKey : undefined;
    this.searchTerm = pageReference?.state?.c__q ?? '';
    this.pageNumber = Number(pageReference?.state?.c__page ?? '1');
}
```

### URL パラメータを更新する

検索条件やページ番号を URL に残す場合は、現在の `PageReference` をもとに新しい `state` を作り、同じ component へ遷移します。既存の state を残すか消すかを明示すると、予期しないパラメータの持ち越しを避けられます。

```js
import { LightningElement, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';

export default class UrlStateSearch extends NavigationMixin(LightningElement) {
    currentPageReference;
    searchTerm = '';

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        this.currentPageReference = pageReference;
        this.searchTerm = pageReference?.state?.c__q ?? '';
    }

    updateSearchTerm(nextSearchTerm) {
        this[NavigationMixin.Navigate](
            {
                ...this.currentPageReference,
                state: {
                    ...this.currentPageReference.state,
                    c__q: nextSearchTerm,
                    c__page: '1'
                }
            },
            true
        );
    }
}
```

`replace=true` にすると、検索文字を変えるたびにブラウザの戻る履歴が増えるのを避けられます。ユーザーが明確に「前の検索条件へ戻る」ことを期待する画面なら `replace=false` も選択肢です。

### コンソールアプリで同じタブにまとめる

Lightning コンソールアプリでは、URL addressable component への遷移が新しいタブとして開くことがあります。同じコンポーネントのタブを重複させたくない場合は、`state` に安定した `uid` を入れます。

```js
this[NavigationMixin.Navigate]({
    type: 'standard__component',
    attributes: {
        componentName: 'c__objectRecordSearch'
    },
    state: {
        c__metricKey: 'accounts',
        uid: 'object-record-search-accounts'
    }
});
```

## パラメータ設計の考え方

`PageReference` は `type`、`attributes`、`state` でできています。まず役割を分けて考えます。

| 場所         | 役割                                        | 例                                            |
| ------------ | ------------------------------------------- | --------------------------------------------- |
| `type`       | どの種類のページへ行くか。                  | `standard__recordPage`、`standard__component` |
| `attributes` | そのページ種別に必須の識別情報。            | `recordId`、`objectApiName`、`componentName`  |
| `state`      | URL query string として持たせる任意の状態。 | `c__metricKey`、`c__q`、`filterName`          |

`state` に入れる値は、次の基準で選びます。

| URL に入れるもの                             | URL に入れないもの                               |
| -------------------------------------------- | ------------------------------------------------ |
| リロード後も復元したい条件。                 | 一時的な loading / saving 状態。                 |
| ブックマークや共有に必要な識別子。           | 大きい JSON や一覧データそのもの。               |
| 検索語、フィルタ、ページ番号、選択中のタブ。 | 秘密情報、個人情報、アクセストークン。           |
| サーバー側で再取得できる ID や key。         | UI 内部だけで完結する hover / modal の一時状態。 |

基本方針は「URL だけで画面を再現するための最小情報」を持たせることです。派生できる値、Apex や LDS で再取得できる値、機密性のある値は URL に載せません。

### 命名

カスタムの `state` キーには名前空間が必要です。名前空間がない組織では `c__` を使います。

```js
state: {
    c__metricKey: 'accounts',
    c__q: 'Acme',
    c__page: '2'
}
```

Salesforce が予約している標準キーもあります。例えば `filterName` や `defaultFieldValues` は `standard__objectPage` で使います。独自パラメータと標準パラメータを混ぜる場合は、独自側に `c__` を付けて衝突を避けます。

### 型

URL の `state` は文字列として扱います。数値や boolean は、渡すときに文字列化し、読むときに変換します。

```js
state: {
    c__page: String(this.pageNumber),
    c__showArchived: String(this.showArchived)
}
```

```js
const pageNumber = Number(pageReference?.state?.c__page ?? '1');
const showArchived = pageReference?.state?.c__showArchived === 'true';
```

複数値を渡したい場合は、URL に載せてよい短い値だけを区切り文字で持たせるか、条件セットを表す ID を渡してサーバー側で復元します。

```js
state: {
    c__status: 'New,Working,Closed';
}
```

```js
const statuses = (pageReference?.state?.c__status ?? '').split(',').filter(Boolean);
```

### パラメータの検証

URL はユーザーが直接編集できます。受け取った値は信用せず、許可リストで検証します。

```js
const ALLOWED_METRIC_KEYS = new Set(['accounts', 'contacts', 'opportunities']);

@wire(CurrentPageReference)
setCurrentPageReference(pageReference) {
    const metricKey = pageReference?.state?.c__metricKey;
    this.metricKey = ALLOWED_METRIC_KEYS.has(metricKey)
        ? metricKey
        : 'accounts';
}
```

Apex に渡す場合も、LWC 側の検証だけで終わらせず、Apex 側でカタログや describe 結果に基づいて再検証します。

### 画面状態と URL の同期

URL を状態の基準にするか、コンポーネントの内部 state を状態の基準にするかを先に決めます。

| 方針                          | 使いどころ                                                           |
| ----------------------------- | -------------------------------------------------------------------- |
| URL を状態の基準にする        | 検索条件、ページ番号、選択中オブジェクトなど、共有・復元したい状態。 |
| 内部 state を状態の基準にする | 保存中、削除確認モーダル、チェック中の行など、画面操作中だけの状態。 |

URL を状態の基準にする場合は、入力変更のたびに Apex を直接呼ぶのではなく、URL 更新と `CurrentPageReference` の反映を経由させると状態の入口が 1 つになります。

```js
handleSearch() {
    this.updateSearchTerm(this.draftSearchTerm.trim());
}

@wire(CurrentPageReference)
setCurrentPageReference(pageReference) {
    this.searchTerm = pageReference?.state?.c__q ?? '';
    this.loadRecords();
}
```

ただし、入力中の文字まで URL に反映すると履歴や再描画が増えます。検索ボタンや Enter のタイミングで URL を更新する方が扱いやすいことが多いです。

## Lightning App Page は必要か

URL で LWC を直接開くためだけなら、Lightning App Page は不要です。`lightning__UrlAddressable` と `standard__component` で遷移できます。

Lightning App Page やタブが必要になるのは、次のような場合です。

| やりたいこと                                   | 必要なもの                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| LWC を URL で直接開く                          | `lightning__UrlAddressable`                                       |
| 別 LWC から URL 付きコンポーネントへ遷移する   | `standard__component`                                             |
| Lightning App Builder でページとして組み立てる | Lightning App Page                                                |
| アプリナビゲーションのタブとして表示する       | Lightning Page タブ、Lightning Component タブ、またはカスタムタブ |
| `standard__navItemPage` で遷移する             | タブの API 名                                                     |
