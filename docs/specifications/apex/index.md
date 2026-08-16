# Apex 機能仕様

Apex で実装した機能の仕様書一覧です。

## 種別一覧

| 種別                         | 内容                           |
| ---------------------------- | ------------------------------ |
| [Trigger](triggers/index.md) | データ変更を起点に実行する処理 |

現在、Apex Batch、Apex Scheduler、および独立した主仕様書を持つApex非同期処理はありません。LWC機能の内部で使用する `AccountDataQualityScanQueueable` は、[取引先データ品質スキャン](../lwc/account-data-quality-scan/index.md)で扱います。
