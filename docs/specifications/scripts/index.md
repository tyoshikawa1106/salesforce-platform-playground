# Scripts 機能仕様

Node.jsスクリプトで実装したリポジトリ運用自動化の仕様書一覧です。

| 機能                       | 実行入口                                                                                                    | 仕様書                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 文書検査スクリプト         | `npm run docs:check`                                                                                        | [文書検査スクリプト](documentation-check/index.md)                   |
| 定期品質チェック結果報告   | GitHub Actionsの定期品質チェック結果報告job                                                                 | [定期品質チェック結果報告スクリプト](ci-quality-reporting/index.md)  |
| テストデータ投入スクリプト | `npm run setup:data:dry-run`、`npm run setup:data`                                                          | [テストデータ投入スクリプト](test-data-import/index.md)              |
| Scratch Org管理スクリプト  | `node scripts/scratch-org/setup.js [--alias <alias>]`、`node scripts/scratch-org/delete.js --alias <alias>` | [Scratch Org管理スクリプト](scratch-org-management/index.md)         |
| メタデータ削除スクリプト   | `npm run sf:destructive`                                                                                    | [メタデータ削除スクリプト](metadata-deletion/index.md)               |
| Profile権限セット変換      | `npm run sf:convert:profile`                                                                                | [Profile権限セット変換スクリプト](permissionset-conversion/index.md) |
| メタデータ取得スクリプト   | `npm run sf:retrieve`                                                                                       | [メタデータ取得スクリプト](metadata-retrieve/index.md)               |
| 組織テスト実行スクリプト   | `npm run sf:test:apex`、`npm run sf:test:flow`                                                              | [組織テスト実行スクリプト](org-tests/index.md)                       |
