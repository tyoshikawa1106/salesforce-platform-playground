# Salesforce 標準ページへの遷移

[LWC の画面遷移](../lwc-navigation.md)に戻る。

## Salesforce の別ページへ遷移する

### NavigationMixin の基本

Lightning Experience、Salesforce モバイル、Experience Builder サイトでは、`lightning/navigation` の `NavigationMixin` と `PageReference` を使います。

```js
import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class NavigationExample extends NavigationMixin(LightningElement) {
    openAccountList() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Account',
                actionName: 'list'
            },
            state: {
                filterName: 'Recent'
            }
        });
    }

    openRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId,
                objectApiName: 'Account',
                actionName: 'view'
            }
        });
    }
}
```

`NavigationMixin.Navigate` には、第 2 引数で `replace` を渡せます。`true` にするとブラウザ履歴の現在位置を置き換えるため、「中間画面を戻る履歴に残したくない」場合に使います。

```js
this[NavigationMixin.Navigate](
    {
        type: 'standard__objectPage',
        attributes: {
            objectApiName: 'Account',
            actionName: 'list'
        }
    },
    true
);
```

### PageReference の種類

主な `PageReference` は次の通りです。

| type                    | 用途                                                     |
| ----------------------- | -------------------------------------------------------- |
| `standard__recordPage`  | レコード詳細、編集、複製へ遷移する。                     |
| `standard__objectPage`  | オブジェクトのホーム、リスト、新規作成へ遷移する。       |
| `standard__navItemPage` | カスタムタブや Lightning Page のタブへ遷移する。         |
| `standard__component`   | URL addressable な LWC / Aura コンポーネントへ遷移する。 |
| `standard__webPage`     | 任意の URL へ遷移する。                                  |

### レコード詳細へ遷移する

一覧の Name リンクやボタンから標準レコード詳細へ遷移する例です。

```js
openRecordPage(recordId, objectApiName) {
    this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
            recordId,
            objectApiName,
            actionName: 'view'
        }
    });
}
```

標準の編集画面へ直接遷移する場合は `actionName` を `edit` にします。

```js
editRecord(recordId, objectApiName) {
    this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
            recordId,
            objectApiName,
            actionName: 'edit'
        }
    });
}
```

### 標準リストビューへ遷移する

標準のオブジェクトリストへ遷移する例です。`filterName` にはリストビュー ID または developer name を渡します。

```js
openAccountRecentList() {
    this[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: {
            objectApiName: 'Account',
            actionName: 'list'
        },
        state: {
            filterName: 'Recent'
        }
    });
}
```

### 標準新規作成画面へ遷移する

標準の新規作成画面を使うなら `standard__objectPage` の `new` を使います。初期値を渡す場合は `lightning/pageReferenceUtils` の `encodeDefaultFieldValues` を使います。

```js
import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { encodeDefaultFieldValues } from 'lightning/pageReferenceUtils';

export default class NewRecordNavigation extends NavigationMixin(LightningElement) {
    createOpportunity(accountId) {
        const defaultFieldValues = encodeDefaultFieldValues({
            AccountId: accountId,
            StageName: 'Prospecting',
            CloseDate: 'YYYY-MM-DD'
        });

        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Opportunity',
                actionName: 'new'
            },
            state: {
                defaultFieldValues
            }
        });
    }
}
```

### カスタムタブへ遷移する

Lightning Page タブや Lightning Component タブなど、ナビゲーション項目として登録された画面へ遷移する例です。

```js
openCustomTab() {
    this[NavigationMixin.Navigate]({
        type: 'standard__navItemPage',
        attributes: {
            apiName: 'Object_Record_Search'
        }
    });
}
```

`standard__navItemPage` はタブの API 名が必要です。URL addressable component へ直接遷移するだけなら、タブは不要です。
