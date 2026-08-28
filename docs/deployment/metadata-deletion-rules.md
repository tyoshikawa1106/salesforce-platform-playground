# メタデータ削除ルール

この文書は、AI エージェントが Salesforce メタデータを削除する destructive changes を扱うときの実行ルールを定義します。

## 実行ルール

- destructive changes は、通常の追加・更新より影響が大きいため別タスクで扱う。
- 削除対象、依存関係、復旧方法、対象 org alias を確認してから実行する。
- 明示依頼なしに本番や別 target org へ削除を実行しない。
- 削除前にdefault target orgのaliasを確認する。リポジトリ管理の削除スクリプトは、alias、ユーザー名、URL、種別を表示し、実行者が接続組織を承認した場合だけ処理を続行する。
- 本番環境とDeveloper Editionでは、接続組織の承認後に環境別の最終確認を行い、再承認された場合だけdry-runへ進む。
- 対象組織を一意に特定できない場合や、組織種別を判定できない場合はSalesforce組織操作を開始しない。
- destructive changes と通常 metadata 更新を同じ実行 scope に混ぜない。必要な場合も差分と検証結果を分けて報告する。
- `manifest/destructivePackage.xml` は削除deployに必要な通常manifestとして扱い、削除専用の実行では追加・更新対象を含めない。
- `manifest/destructiveChanges.xml` は通常時に削除対象を持たない状態で管理し、作業中だけ実在する削除対象を追加する。作業後にプレースホルダーや不要な削除対象を残さない。
- 削除スクリプトは組織種別にかかわらず、必要な事前確認の後にdry-runを実行し、成功した場合は同じ対象を実削除する。テストレベルは明示せず、Salesforce標準の判定に従う。
- 本番実行前は、同じ削除対象をSandboxで削除し、Apexテストと対象に応じた画面、Flow、外部連携を確認する。

## 削除前確認

削除前に次を確認します。

- 削除する metadata type と名前
- Apex、Flow、Permission Set、Page Layout、Lightning Page などの参照
- 削除後に必要なテストや画面確認
- 復旧する場合に戻せる source があるか

対象組織を確認します。削除スクリプトは、この設定値とSalesforce CLIの認証済み組織情報を照合します。

```sh
sf config get target-org
```

## Apex クラス削除

削除対象の Apex クラスは `manifest/destructiveChanges.xml` の `ApexClass` に実際のクラス名で書きます。

削除対象が未設定、またはプレースホルダーやワイルドカードが残っている場合は、組織情報を取得せず停止します。対象が有効な場合はdefault target orgのalias、ユーザー名、URL、種別が表示されます。

接続組織を承認するとdry-runを実行し、成功後は同じ対象組織とmanifestで実削除します。dry-runと実削除ではテストレベルを明示せず、Salesforce標準の判定に従います。本番環境とDeveloper Editionではdry-run前に環境別の追加確認を行います。

```sh
npm run sf:destructive
```

すべての確認では`y`または`Y`だけを承認として扱います。接続組織または環境別確認が承認されない場合は組織操作を開始しません。SandboxとScratch Orgでは環境別確認を省略します。削除成功後は、同じDefault Target Orgで`npm run sf:test:apex`を実行するよう案内します。

## destructive changes 実行手順

- 削除スクリプトは、通常manifestに`manifest/destructivePackage.xml`、削除対象manifestに`manifest/destructiveChanges.xml`を使用する。
- destructive manifest は作業単位ごとに最小化する。
- dry-runと実削除ではテストレベルを明示せず、対象組織とmetadataに応じたSalesforce標準の判定に従う。部分成功を許可しないため、`--ignore-errors`は使用しない。
- dry-runと実削除は非同期で開始し、job IDを表示して`done`になるまで監視する。個々のSalesforce CLI呼び出しは2分でタイムアウトする。Salesforce CLIが返す`Succeeded`以外または実行種別の不一致は成功扱いにしない。
- 開始結果を取得できない場合は開始状況不明として自動再実行を禁止し、SalesforceのDeployment Statusを案内する。監視中にCtrl+Cを受けた場合や完了結果を検証できない場合は、job IDを指定した`sf project deploy report`コマンドを案内する。
- 削除と無関係な metadata 更新を同じ変更に混ぜない。
- 削除に伴う権限、レイアウト、Flow、Apex の修正は差分を明確に分けて確認する。
- Apex クラスなど source から削除する metadata は、ローカルファイル削除と org 側 destructive deploy の両方が必要かを確認する。
- destructive deployの削除対象はmanifestで指定し、削除処理と対象ごとの結果判定はSalesforce CLIとMetadata APIに委ねる。追加の実環境確認が必要な場合は、Tooling APIまたはretrieveも使用する。
- 文字列で指定した項目API名は静的な項目参照として判定されないため、動的SOQLやDescribe処理などの該当経路をApexテストで実行し、結果をassertする。
- ApexテストはVisualforceマークアップ、画面描画、Flow、外部連携の動作を保証しない。削除対象に応じて、削除後スキーマで関連画面や処理を別途確認する。

## PR レビュー観点

PR では次を重点的に確認します。

- 削除対象がタスク範囲内か。
- 参照元が残っていないか。
- 復旧手順や rollback 方針が説明できるか。
- validate / deploy / test の結果が報告されているか。

## 報告ルール

destructive changes を扱った場合は次を報告します。

- 対象 Salesforce 組織の alias
- 削除した metadata type と名前
- 依存確認の結果
- 実行した validate / deploy / test
- 復旧方針、または復旧不要と判断した理由
