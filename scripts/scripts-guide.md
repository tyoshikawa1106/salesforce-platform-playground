# scripts ガイド

`scripts/` には、リポジトリで管理する補助スクリプトとクエリファイルを置きます。

- `scripts/setup/`: 初期 org セットアップ用の Node 実行入口と plan。
- `scripts/docs/`: Git管理対象と未追跡・非除外のMarkdownを自動検出し、ローカルリンク、外部リンク、見出し、ファイル名、索引到達性を確認するNodeスクリプト。通常文書と文書断片でH1要件を分ける。
- `scripts/apex/`: 用途別に整理した anonymous Apex スクリプト。
- `scripts/soql/`: テストデータ確認用とオブジェクト別確認用の SOQL ファイル。
- `scripts/deploy/`: デプロイや org 再構築の補助スクリプト。
- `scripts/retrieve/`: VS Codeで現在接続している組織から、分割manifestを順番にretrieveするシェルスクリプト。

生成された export ファイルや bulk 結果ファイルは `scripts/` に置きません。Salesforce CLI のローカル export 出力は `export-out/`、bulk results の出力は `logs/data-bulk-results/` に書き出します。

標準オブジェクトの初期データセットアップと export 例は [test-data-import.md](../docs/deployment/test-data-import.md) を参照してください。
