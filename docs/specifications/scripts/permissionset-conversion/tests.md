# Profile権限セット変換スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

```sh
node --test scripts/permissionset-conversion/test/*.node.js
```

主な確認内容です。

- 変換入口がDefault Target Orgと認証済み組織情報を表示し、承認後だけ処理する
- 本番環境では追加確認を行い、組織情報を変換内容には使用しない
- Profile XMLに明示された移行可能な権限を、固定件数ではなく要素名と値で比較する
- 表示可能な割り当てアプリケーションを移行し、デフォルトアプリケーション指定だけをProfileへ残す
- Assigned Apps非対応User LicenseとOverage系同等ライセンスではアプリケーション表示権限をProfileへ残す
- dry-run確認済みまたは公式Helpで同等のUser LicenseだけAssigned Appsを移行する
- Assigned Appsの変換対応一覧にないUser Licenseの表示アプリがある場合は生成を止める
- 対応User Licenseでは標準アプリを含む表示総件数から上限を推測せず、割り当て適合性を確認事項へ残す
- XMLの名前付き参照と数値文字参照を復号し、API名、ライセンス、重複判定、保存結果比較へ適用する
- Profile、関連CustomField、比較するPermission SetのDOCTYPEを拒否し、コメントやCDATA内の文字列は誤検知しない
- `ApiUserOnly=true`ではVisualforceページだけを除外し、ApexクラスとAPI専用権限を維持する
- ライセンス名や無効な`ApiUserOnly`からVisualforceページアクセスを除外しない
- Git管理fixtureへ権限を追加した場合も、追加後のProfile XMLとの意味的一致を確認する
- 明示したUser Permission依存以外では、Profile XMLにないObject Permissionを追加しない
- `EditPublicDocuments`からMetadata APIが要求する`Document` CRUDだけを依存権限として補完する
- `EditHtmlTemplates`からMetadata APIが要求する`Document`参照権限だけを補完する
- `ViewAllData`から`Document`の参照権限と全レコード参照権限だけを重複なく補完する
- `Entitlement`の参照権限から`Account`の参照権限だけを重複なく補完する
- 必須、Master-Detail、数式項目をローカルmetadataから判定する
- 関連metadataがない項目を勝手に除外せず、手動validate対象として保持する
- 未対応要素・子要素・タブ表示状態はスキップして記録し、対応済み権限を生成する
- 未対応の子要素があっても、対応済みの子要素は従来どおり変換する
- スキップだけならXML・レポート・後続コマンドを生成し、終了コード0を返す
- スキップと矛盾した設定が混在しても、矛盾による生成停止を維持する
- 重複、不正XML、必須設定の欠落は引き続き拒否する
- Metadata APIで必須のアプリケーションとレコードタイプの`default`値がない入力を拒否する
- Profileファイル名のpercent decode、User Licenseの正規化と文字数制限、一意なラベル制約を確認する
- 実行ごと、Profileごとに異なる仮API名を生成する
- 同じUser LicenseのProfileを同時に変換してもProfile連番でAPI名が重複しない
- Guest User LicenseのProfileだけを除外し、Chatterを含む生成対象へ連続するProfile連番を付ける
- Chatterのライセンス制約対象だけを省略し、その他の権限・依存ペア・元のライセンスを維持する
- 通常のCLIでChatterのXMLとスキップ明細を生成し、無効設定や入力エラーを制約による省略と区別する
- dry-runでファイルを作成せず、通常実行では日時別出力を作る
- 最終配置は完成した一時ファイルのハードリンクを排他的に作成し、存在確認後の競合でも既存ファイルを上書きしない
- 出力途中の失敗時にbatch全体をrollbackし、他実行の一時ファイルは削除しない
- 再取得先の不存在・空・対象XMLなしを欠落として記録し、CLIでもレポート保存後に終了コード1を返す
- 生成元の空入力と再取得先の読み取りエラーは、欠落との混同なく拒否する
- dry-run、deploy、保存結果確認コマンドが今回の出力フォルダだけを対象にする
- 保存後の意味差分を検出し、割り当てアプリケーションの順序差を無視して、変換結果へ反映せず比較レポートへ保存する

単体テストはSalesforce CLI応答をstub化し、実組織へ接続しません。組織へのデプロイ適合性、保存値、User Licenseへの割り当て適合性は、利用者がDefault Target Orgを確認して実行する後続工程で確認します。

## テストファイルと代表的なケース

| ファイル                                                                                                             | 確認内容                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [permission-set-verifier.node.js](../../../../scripts/permissionset-conversion/test/permission-set-verifier.node.js) | XML文字参照の表記差を無視し実際の値変更は検出する。Permission Set比較で内部・外部DOCTYPEを拒否する。                          |
| [profile-converter.node.js](../../../../scripts/permissionset-conversion/test/profile-converter.node.js)             | 有効なProfile権限だけをPermission Set候補へ変換する。Assigned Appsを許可しないUser LicenseではアプリアクセスをProfileへ残す。 |
