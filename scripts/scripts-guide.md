# scripts ガイド

`scripts/` には、リポジトリで管理する補助スクリプトとクエリファイルを置きます。

- `scripts/internal/`: 複数の実行スクリプトから読み込む共通処理。Node.js testは`test/`に格納する。
- `scripts/ci/`: GitHub Actionsの定期品質チェック結果をIssueへ記録するNodeスクリプト。GitHub操作の分岐は`test/`で検証する。
- `scripts/setup/`: 初期 org セットアップ用のNode実行入口と内部処理。実行計画は`plans/`に格納する。
- `scripts/docs/`: Git管理対象と未追跡・非除外のMarkdownを自動検出し、ローカルリンク、見出し、ファイル名、索引到達性を確認するNodeスクリプト。
- `scripts/apex/`: 用途別に整理した anonymous Apex スクリプト。標準オブジェクトseedは共通preambleとobject固有処理を実行時に合成する。
- `scripts/org-tests/`: Default Target Orgを確認し、本番環境では追加確認を行ってからApexテストまたはFlowテストを開始し、進捗と結果を取得するNodeスクリプト。
- `scripts/soql/`: テストデータ確認用とオブジェクト別確認用の SOQL ファイル。
- `scripts/metadata/destructive/`: Salesforce組織からメタデータを削除するNodeスクリプト。
- `scripts/metadata/retrieve/`: Salesforce CLIに設定されているDefault Target Orgから、スクリプトに定義した順序で分割manifestをretrieveするNodeスクリプト。
- `scripts/scratch-org/`: Scratch Orgの準備・削除を行う実行スクリプト。読み込み専用処理は`internal/`、setupから実行する各手順は`steps/`に分ける。

各領域の直下には、npm scriptや利用者が直接実行する入口を置きます。ほかのスクリプトから読み込むだけの処理は`internal/`、親スクリプトから子プロセスとして実行する処理は`steps/`、入口スクリプト自体のNode.js testは`test/`に置きます。

生成された export ファイルや bulk 結果ファイルは `scripts/` に置きません。Salesforce CLI のローカル export 出力は `export-out/`、bulk results の出力は `logs/data-bulk-results/` に書き出します。

標準オブジェクトの初期データセットアップと export 例は [test-data-import.md](../docs/deployment/test-data-import.md) を参照してください。
