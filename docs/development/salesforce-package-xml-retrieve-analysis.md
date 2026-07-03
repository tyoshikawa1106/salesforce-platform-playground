# package.xml retrieve の分析ポイント

Salesforce DX で広い `package.xml` を使って metadata retrieve すると、コマンドが成功しても一部メタデータが取得できていないことがあります。

この文書は、`sf project retrieve start --manifest <package.xml> --json` の結果を確認するときの観点をまとめます。

## 確認する場所

`--json` の結果では、次の値を分けて確認します。

| 場所                    | 見る内容                                               |
| ----------------------- | ------------------------------------------------------ |
| `status`                | CLI コマンド全体の終了状態                             |
| `warnings`              | CLI が返す警告                                         |
| `result.messages`       | Metadata API retrieve が返す個別問題                   |
| `result.fileProperties` | 実際に retrieve 対象として返ってきたメタデータ一覧     |
| `result.files`          | ローカルへ作成、更新、削除されたソース形式ファイル一覧 |

`status: 0` でも `result.messages` に問題が入ることがあります。成功扱いだけで判断せず、`messages` を必ず確認します。

## CLI registry で止まる type

`describeMetadata` に出る type でも、Salesforce CLI の source-deploy-retrieve registry が未対応だと retrieve 開始前に失敗します。

例:

```text
Missing metadata type definition in registry for id '<MetadataType>'
```

この場合、対象 type は現在の CLI がソース形式に変換できません。対応方法は次のどれかです。

- 一時 manifest から該当 type を外して retrieve を続ける。
- CLI / source-deploy-retrieve の更新で対応済みか確認する。
- Metadata Coverage Report と CLI registry を確認し、未対応なら CLI 側の制約として扱う。

今回の確認では、次の type が CLI registry 未対応でした。

- `PlatformEventMigration`
- `ExperienceContainer`
- `TagSet`

## `result.messages` に出る代表例

retrieve が成功しても、`result.messages` に取得不可の理由が出ることがあります。

| 例                                                                  | 意味                                                   | 見直し方向                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `Entity of type 'Report' named '*/' cannot be found`                | wildcard 指定で対象を見つけられていない                | レポートフォルダ配下の member 指定を検討する                     |
| `Entity of type 'Dashboard' named '*/' cannot be found`             | wildcard 指定で対象を見つけられていない                | ダッシュボードフォルダ配下の member 指定を検討する               |
| `Can't retrieve non-customizable CustomObject named: BusinessHours` | 標準オブジェクトだが `CustomObject` として取得できない | `CustomObject` の明示 member から外す                            |
| `Unable to retrieve file ... of type Flow`                          | 対象 Flow を取得する権限や機能が不足している           | 権限、ライセンス、機能有効化、対象 Flow 種別のアクセスを確認する |
| `Unable to retrieve file ... of type FlowDefinition`                | FlowDefinition 側でも同じ制約を受けている              | Flow と同じ前提を確認する                                        |

## `fileProperties.type` と manifest type は一致しないことがある

manifest に書いた `<name>` と、retrieve 結果の `fileProperties.type` が 1 対 1 で一致しない場合があります。

代表例:

- `CustomField`
- `RecordType`
- `BusinessProcess`
- `FieldSet`
- `ListView`
- `ValidationRule`
- `WebLink`
- `CompactLayout`

これらは `CustomObject` 配下の子メタデータとして、`objects/<ObjectName>/...` に出力されることがあります。

そのため、`fileProperties.type` に対象 type がないだけで「未取得」と判断しないようにします。ローカルに生成された `objects/` 配下のファイルも確認します。

## 標準オブジェクトの取得

`CustomObject` の `<members>*</members>` は、カスタムオブジェクト取得には有効ですが、標準オブジェクトのカスタマイズ情報を網羅する用途には不足します。

標準オブジェクトの metadata を取得したい場合は、次のように個別指定します。

```xml
<types>
    <members>Account</members>
    <members>Contact</members>
    <members>Opportunity</members>
    <members>*</members>
    <name>CustomObject</name>
</types>
```

ただし、すべての標準オブジェクトが `CustomObject` として取得できるわけではありません。`BusinessHours` のように non-customizable として拒否されるものがあります。

## 分析手順

広い manifest を検証するときは、次の順で見ると切り分けやすくなります。

1. 元の manifest で retrieve を実行する。
2. CLI registry エラーで開始できない type を特定する。
3. 必要なら一時 manifest から未対応 type だけ外して retrieve を続ける。
4. `result.messages` を確認し、取得不可の理由を分類する。
5. `fileProperties` の type 件数を集計する。
6. `objects/` 配下など、子メタデータとして出力されたファイルを確認する。
7. manifest 側で外す type、個別 member 指定に変える type、権限や機能確認が必要な type を分ける。

## 注意点

retrieve はローカルの `force-app/main/default` を直接更新します。

広い manifest で検証すると、大量の既存ファイル更新や未追跡ファイル追加が発生します。分析目的で実行する場合は、事前に作業ツリーを clean にしておき、retrieve 後の差分をコミット対象にするか破棄するかを明確にします。
