# Apex 機能仕様

Apex で実装した機能の仕様書一覧です。

## 種別一覧

| 種別                             | 内容                           |
| -------------------------------- | ------------------------------ |
| [Trigger](triggers/index.md)     | データ変更を起点に実行する処理 |
| [Batch](batches/index.md)        | 大量レコードを分割して処理     |
| [Scheduler](schedulers/index.md) | 指定時刻に処理を開始           |

[取引先一括削除バッチ](batches/account-delete/index.md)と[定期実行](schedulers/account-delete/index.md)を提供します。LWC機能の内部で使用する `AccountDataQualityScanQueueable` は、[取引先データ品質スキャン](../lwc/account-data-quality-scan/index.md)で扱います。
