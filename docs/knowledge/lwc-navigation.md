# LWC の画面遷移

Lightning Web Component では、画面遷移の作り方を大きく 2 種類に分けられます。

- 同じ Lightning ページ上で、コンポーネント内部の状態だけを切り替える。
- `lightning/navigation` を使い、Salesforce の別ページや URL 付きコンポーネントへ遷移する。

どちらも正しい方法です。URL を変えたいか、ブラウザの戻る・共有・リロード復元を使いたいかで選びます。

## テーマ別ページ

| テーマ                                                                           | 内容                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| [コンポーネント内の画面切り替え](lwc-navigation/component-state-navigation.md)   | 同じ Lightning ページ内で状態を切り替える方法    |
| [Salesforce 標準ページへの遷移](lwc-navigation/salesforce-page-navigation.md)    | レコード、リスト、新規作成、カスタムタブへの遷移 |
| [URL addressable component の設計](lwc-navigation/url-addressable-navigation.md) | 独自 LWC の URL 化、パラメータ、コンソールタブ   |

## 選び方

| 方針                     | 向いているケース                                                       | 注意点                                           |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------ |
| コンポーネント内切り替え | 同じ画面内の軽い表示切り替え。親子コンポーネントで状態を閉じたい場合。 | URL 共有やブラウザ履歴との相性は弱い。           |
| `standard__recordPage`   | 標準レコード詳細や編集へ飛ばす場合。                                   | レコード ID が必要。                             |
| `standard__objectPage`   | 標準リストビューや標準新規作成画面を使う場合。                         | 独自 UI ではなく標準画面へ遷移する。             |
| `standard__component`    | 独自 LWC を独立画面として URL 化したい場合。                           | 対象 LWC に `lightning__UrlAddressable` が必要。 |
| `standard__navItemPage`  | タブとして登録した画面へ移動したい場合。                               | タブを用意する必要がある。                       |

一覧や詳細検索のように、URL 共有、ブラウザ戻る、リロード復元が欲しい画面は `standard__component` が扱いやすいです。小さな表示切り替えだけなら、コンポーネント内の状態切り替えで十分です。

## 参考

- [Navigate to Pages, Records, and Lists](https://developer.salesforce.com/docs/platform/lwc/guide/use-navigate.html)
- [PageReference Types](https://developer.salesforce.com/docs/platform/lwc/guide/reference-page-reference-type.html)
- [Navigate to a URL-Addressable Component](https://developer.salesforce.com/docs/platform/lwc/guide/use-navigate-url-addressable.html)
