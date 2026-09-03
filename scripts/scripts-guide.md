# scripts ガイド

`scripts/` には、リポジトリで管理する補助スクリプトとクエリファイルを置きます。

- `scripts/common/`: 複数の実行スクリプトから読み込む共通処理。Node.js testは`test/`に格納する。
- `scripts/ci/`: GitHub Actionsの定期品質チェック結果をIssueへ記録するNodeスクリプト。処理内容は[定期品質チェック結果報告スクリプト仕様](../docs/specifications/scripts/ci-quality-reporting/index.md)を参照する。
- `scripts/setup/`: テストデータ投入用のNode実行入口と内部処理。実行計画は`plans/`に格納する。処理内容は[テストデータ投入スクリプト仕様](../docs/specifications/scripts/test-data-import/index.md)を参照する。
- `scripts/docs/`: Git管理対象と未追跡・非除外のMarkdownを自動検出し、ローカルリンク、見出し、ファイル名、索引到達性を確認するNodeスクリプト。処理内容は[文書検査スクリプト仕様](../docs/specifications/scripts/documentation-check/index.md)を参照する。
- `scripts/apex/`: 用途別に整理した anonymous Apex スクリプト。標準オブジェクトseedは共通preambleとobject固有処理を実行時に合成する。
- `scripts/org-tests/`: Default Target Orgを確認し、本番環境では追加確認を行ってからApexテストまたはFlowテストを開始し、進捗と結果を取得するNodeスクリプト。処理内容は[組織テスト実行スクリプト仕様](../docs/specifications/scripts/org-tests/index.md)を参照する。
- `scripts/soql/`: テストデータ確認用とオブジェクト別確認用の SOQL ファイル。
- `scripts/metadata/destructive/`: Salesforce組織からメタデータを削除するNodeスクリプト。処理フローと表示は[メタデータ削除スクリプト仕様](../docs/specifications/scripts/metadata-deletion/index.md)を参照する。
- `scripts/permissionset-conversion/`: Default Target Orgの認証済み組織情報を確認した後、ローカルProfile XMLと関連CustomField metadataだけを使用し、有効な付与権限をProfileごとのPermission Set metadataへ変換するNodeスクリプト。組織情報は変換内容へ使用せず、生成後のvalidate、dry-run、deploy、保存結果確認は対象組織を明示して手動実行する。処理内容は[Profile権限セット変換スクリプト仕様](../docs/specifications/scripts/permissionset-conversion/index.md)を参照する。
- `scripts/metadata/retrieve/`: Salesforce CLIに設定されているDefault Target Orgから、スクリプトに定義した順序で分割manifestをretrieveするNodeスクリプト。処理内容は[メタデータ取得スクリプト仕様](../docs/specifications/scripts/metadata-retrieve/index.md)を参照する。
- `scripts/scratch-org/`: Scratch Orgの準備・削除を行う実行スクリプト。読み込み専用処理は`internal/`、setupから実行する各手順は`steps/`に分ける。処理内容は[Scratch Org管理スクリプト仕様](../docs/specifications/scripts/scratch-org-management/index.md)を参照する。

各領域の直下には、npm scriptや利用者が直接実行する入口を置きます。複数のトップレベル領域から読み込む共通処理は`scripts/common/`、特定領域内だけで読み込む処理はその領域の`internal/`、親スクリプトから子プロセスとして実行する処理は`steps/`、Node.js testは`test/`に置きます。

生成された export ファイルや bulk 結果ファイルは `scripts/` に置きません。Salesforce CLI のローカル export 出力は `export-out/`、bulk results の出力は `logs/data-bulk-results/` に書き出します。

標準オブジェクトの初期データセットアップと export 例は [test-data-import.md](../docs/deployment/test-data-import.md) を参照してください。
