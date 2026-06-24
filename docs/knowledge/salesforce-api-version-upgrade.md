# Salesforce API version の上げ方

Salesforce の seasonal release 後は、組織で使える API version とリポジトリの metadata version がずれることがあります。

Salesforce DX プロジェクトでは、主に次の 2 種類を確認します。

| 対象                | 例                             | 役割                                                  |
| ------------------- | ------------------------------ | ----------------------------------------------------- |
| `sourceApiVersion`  | `sfdx-project.json`            | source convert / deploy / retrieve などの基準 version |
| metadata の version | `*-meta.xml` の `<apiVersion>` | Apex class、trigger、LWC など個別 metadata の version |

## 確認すること

まず、現在接続中の組織が新しい API version を使えるか確認します。

```sh
sf org display
```

`apiVersion` が期待する version になっていれば、その組織では新しい API version を利用できます。

Salesforce CLI がローカル Node.js との相性で起動しない場合は、CLI の更新、Node.js の LTS version での実行、または別のインストール経路を確認します。CLI 起動エラーと API version 非対応は切り分けて考えます。

## 更新する場所

プロジェクト全体の version を更新します。

```json
{
    "sourceApiVersion": "67.0"
}
```

Apex class や trigger など、`*-meta.xml` に `<apiVersion>` を持つ metadata も同じ version に揃えます。

```xml
<apiVersion>67.0</apiVersion>
```

一括置換する場合は、対象が API version だけか差分で確認します。

```sh
rg -n "66\\.0|67\\.0|sourceApiVersion|<apiVersion>" sfdx-project.json force-app
git diff
```

## 検証すること

metadata version を上げた後は、deploy validate で組織が受け付けるか確認します。

```sh
npm run sf:validate:dev
```

`manifest/deployable-dev.xml` に含まれない metadata の version を更新した場合は、今回 version を更新した metadata に scope を絞って検証します。

```sh
sf project deploy validate \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger
```

validate が成功したら、同じ scope で deploy します。

```sh
sf project deploy start \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger
```

Apex class や trigger を含む場合、validate 時または PR 前に関連 Apex テストも確認します。

## 注意点

- `sourceApiVersion` だけを上げても、既存 metadata の `<apiVersion>` は自動では変わりません。
- 新しい API version でコンパイルされるため、Apex や metadata の挙動差分がないか validate / test で確認します。
- 接続先 org を切り替えて確認する場合は、意図した org か先に確認します。
- deploy URL、access token、instance URL などの認証情報や組織固有値は、作業メモやコミットに残しません。
- 全体 validate の失敗が既存 metadata 由来の場合は、今回の version 更新による失敗かどうかを切り分けます。

## 参考リンク

- [Salesforce Release Notes](https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm&type=5)
- [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta)
- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)
