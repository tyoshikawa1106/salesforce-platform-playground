# scripts ガイド

`scripts/` には、リポジトリで管理する補助スクリプトとクエリファイルを置きます。

- `scripts/setup/`: 初期 org セットアップ用の Node 実行入口、検証可能なcore、plan。
- `scripts/docs/`: Git管理対象と未追跡・非除外のMarkdownを自動検出し、ローカルリンク、見出し、ファイル名、索引到達性を確認するNodeスクリプト。CLIと検証coreを分け、通常文書と文書断片でH1要件を分ける。
- `scripts/apex/`: 用途別に整理した anonymous Apex スクリプト。標準オブジェクトseedは共通preambleとobject固有処理を実行時に合成する。
- `scripts/soql/`: テストデータ確認用とオブジェクト別確認用の SOQL ファイル。
- `scripts/metadata/destructive/`: Salesforce組織からメタデータを削除するdestructive deployスクリプト。
- `scripts/metadata/retrieve/`: VS Codeで現在接続している組織から、planに定義した順序で分割manifestをretrieveするシェルスクリプト。
- `scripts/scratch-org/`: Scratch Orgの準備・削除を行う実行スクリプトと、`internal-`で始まる内部処理。

生成された export ファイルや bulk 結果ファイルは `scripts/` に置きません。Salesforce CLI のローカル export 出力は `export-out/`、bulk results の出力は `logs/data-bulk-results/` に書き出します。

標準オブジェクトの初期データセットアップと export 例は [test-data-import.md](../docs/deployment/test-data-import.md) を参照してください。
