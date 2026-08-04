# LWC State Managers

LWC State Managers は、関連する状態と、その状態を変更する処理を専用の JavaScript module へまとめる仕組みです。
Summer '26（API version 67.0）で一般提供され、`@lwc/state` module と Salesforce データ向けの組み込み State Manager が追加されました。

既存の `@api`、Custom Event、Lightning Message Service、`@wire` を置き換える必須機能ではありません。
単一コンポーネントや単純な親子連携では従来方式を使い、複数コンポーネントが同じ状態を参照、更新する画面で検討します。

## State Manager の構成

`defineState()` に状態定義を渡すと、State Manager のインスタンスを作る factory が返ります。
状態定義では、次の primitive を使います。

| primitive                        | 役割                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `atom(initialValue)`             | 変更を追跡する状態を作る。                                  |
| `computed([dependencies], fn)`   | 依存する状態から派生値を作る。                              |
| `setAtom(targetAtom, nextValue)` | `atom` を更新し、LWC のリアクティブシステムへ変更を伝える。 |

State Manager が返す object は、外部へ公開する状態と action を定義します。コンポーネントは State Manager インスタンスの
`value`から公開値と action を参照します。

```js
import { defineState } from '@lwc/state';

export default defineState(({ atom, computed, setAtom }, initialValue = 0) => {
    const count = atom(initialValue);
    const doubled = computed([count], (value) => value * 2);

    const increment = () => {
        setAtom(count, count.value + 1);
    };

    return {
        count,
        doubled,
        increment
    };
});
```

`atom` は直接代入せず、action から `setAtom()` で更新します。`computed` は依存値が変わったときに再評価され、同じ tick 内の
複数の `setAtom()` はまとめて通知されます。状態値には JSON へ変換できる値または `undefined`を使うと互換性を保ちやすくなります。

共有する State Manager は、HTML templateを持たないAPI moduleとして配置します。

```text
counterState/
├── counterState.js
└── counterState.js-meta.xml
```

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>
```

## コンポーネント間で共有する

上位コンポーネントが State Manager のインスタンスを保持すると、子孫コンポーネントは `fromContext()` で最も近い同種の
インスタンスを取得できます。

Provider となる上位コンポーネントでは factory を呼び出します。

```js
import { LightningElement } from 'lwc';
import createCounterState from 'c/counterState';

export default class CounterContainer extends LightningElement {
    counterState = createCounterState();
}
```

子孫の Consumer では同じ factory を `fromContext()`へ渡します。

```js
import { LightningElement } from 'lwc';
import { fromContext } from '@lwc/state';
import createCounterState from 'c/counterState';

export default class CounterButton extends LightningElement {
    counterState = fromContext(createCounterState);

    get count() {
        return this.counterState.value?.count;
    }

    handleIncrement() {
        this.counterState.value.increment();
    }
}
```

Context の解決には次の制約があります。

- Consumer は同じコンポーネントツリーの子孫である必要がある。
- Consumer は自身から祖先方向へ探索し、最も近い同種のインスタンスを取得する。
- Provider は DOM 接続時までにインスタンスをプロパティへ保持し、接続後に参照自体を差し替えない。
- Consumer は DOM 接続前の constructor などから State Manager の値を参照しない。
- DOM、要素、イベントなどの UI 処理は State Manager へ入れず、コンポーネントに残す。

単にイベントをなくすためだけに State Manager を導入する必要はありません。利用者操作を親へ知らせる明確な UI Event は、
State Manager と併用できます。

## Salesforce データ向けの組み込み State Manager

`lightning` namespace には、Lightning Data Service（LDS）とUI APIを利用する組み込みState Managerがあります。

- `lightning/stateManagerRecord`
- `lightning/stateManagerObjectInfo`
- `lightning/stateManagerObjectInfos`
- `lightning/stateManagerLayout`
- `lightning/stateManagerRelatedListInfo`
- `lightning/stateManagerRelatedListRecords`
- `lightning/stateManagerRelatedListsInfo`

組み込みState Managerは共通して`status`、`data`、`error`を公開します。`status`は`unconfigured`、`loading`、
`loaded`、`error`のいずれかです。LDSのキャッシュ、正規化、購読機構にも参加します。

State Manager はコンポーネントではないため、State Manager 内で wire adapter は使用できません。組み込みState Managerを組み合わせて
UI APIデータを扱うか、コンポーネント側に`@wire`を残します。命令的Apexによる変更など、LWCとLDSのリアクティブ機構外で発生した変更は
自動検知されません。

## 従来方式との使い分け

| 状況                                           | 第一候補                            |
| ---------------------------------------------- | ----------------------------------- |
| 1つのコンポーネント内で完結する状態            | 通常のプロパティと getter           |
| 単純な親から子への入力                         | `@api`                              |
| 子から親への操作通知                           | Custom Event                        |
| コンポーネントツリー外の疎結合な通知           | Lightning Message Service           |
| 単独コンポーネントでSalesforceデータを取得する | `@wire`とLDS                        |
| 複数の子孫が同じ状態とactionを利用する         | `@lwc/state`と`fromContext()`       |
| ページやアプリ単位でUI APIデータ取得を統合する | 組み込みState Managerとの組み合わせ |

State Manager は、次の問題が現れた場合に効果を得やすくなります。

- 値を利用しない中間コンポーネントにも`@api`を渡す Prop Drilling が増えた。
- 同じ状態変更を複数の子孫へ通知するイベント中継が増えた。
- 検索条件、選択状態、ページングなどを複数の表示部品が共同で利用する。
- データ取得、派生値、更新actionをUIコンポーネントから分離したい。
- ページまたはアプリ単位で複数のデータ取得を連動させたい。

次の場合は従来方式の方が処理を追いやすくなります。

- 親子関係が浅く、受け渡す値とイベントが少ない。
- 状態を使うコンポーネントが1つだけである。
- `@wire`と表示処理だけで完結している。
- State Managerを追加すると、処理を確認するmoduleが増えるだけである。

コンポーネント数だけを機械的な採用条件にせず、Prop Drilling、イベント中継、共有する状態、責務の分散を確認して判断します。

## 既存実装を見直すときの考え方

State Managersの一般提供は、既存LWCを移行する合図ではありません。既存実装が単純で責務も明確なら、そのまま維持します。

見直す場合は、次の順序で確認します。

1. 同じ状態を参照、更新するコンポーネントを確認する。
2. `@api`の中継とCustom Eventの中継が実際に問題になっているか確認する。
3. 状態、派生値、actionの境界を決める。
4. `@wire`、Toast、Navigation、DOM操作など、コンポーネントへ残す処理を決める。
5. 従来方式より参照先とライフサイクルが分かりやすくなるか比較する。
6. State Manager単体と、Provider／Consumerの接続をJestで確認する。

画面を複数の表示部品へ分割した結果、共有状態の受け渡しが複雑になった時点が有力な導入タイミングです。State Managerを使うためだけに
コンポーネントを分割したり、単純なイベントまで状態変更へ置き換えたりしません。

## 制限

- Lightning Experienceで利用できる。
- Experience Cloudでは現在サポートされていない。
- State ManagerはDOM固有APIや要素、イベントへ依存させない。
- `fromContext()`で共有する場合はDOM接続時のContext解決を考慮する。
- 組み込みState ManagerだけでカスタムApexの検索や更新を置き換えられるわけではない。

## 参考

- [LWC State Managers: Share Reactive State Across Components](https://developer.salesforce.com/blogs/2026/07/lwc-state-managers-share-reactive-state-across-components)
- [Manage State Across LWC Components with State Managers](https://developer.salesforce.com/docs/platform/lwc/guide/state-management.html)
- [Define a State Manager](https://developer.salesforce.com/docs/platform/lwc/guide/state-management-define.html)
- [Share a State Manager Across Components](https://developer.salesforce.com/docs/platform/lwc/guide/state-management-example-fromcontext.html)
- [`lightning/stateManager*` State Managers](https://developer.salesforce.com/docs/platform/lwc/guide/reference-state-managers.html)
- [Best Practices for State Manager Design](https://developer.salesforce.com/docs/platform/lwc/guide/reference-state-managers-design.html)
- [forcedotcom/state-management](https://github.com/forcedotcom/state-management)
