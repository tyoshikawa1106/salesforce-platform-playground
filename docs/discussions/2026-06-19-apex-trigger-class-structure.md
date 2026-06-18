# Apex Trigger クラス構成

## 位置づけ

この文書は、Codex が最初に提案した Apex trigger のクラス構成に対して、運用上の課題を整理し、Codex が途中で見直した構成案をまとめたものです。

## Codex の最初の構成案

```text
AccountTrigger
  -> AccountTriggerHandler
      -> AccountNameNormalizer
      -> AccountXxxAction
      -> AccountYyyAction
```

この構成は、処理ごとの責務が明確になる。
一方で、機能追加のたびにクラスが増えやすい。

## 課題

- 処理単位でクラスを増やすと、ファイル数が膨らみやすい。
- クラスが多くなると、改修時に確認すべき場所が増える。
- before / after で service を分けると、両方で使う処理の置き場に迷う。
- オブジェクト単位 selector は再利用しやすいが、大量の機能がある場合に用途を追いにくい。

## Codex が途中で見直した構成案

```text
AccountTrigger
  -> AccountTriggerHandler
      -> AccountTriggerService
          -> AccountTriggerSelector
```

### 役割

- `AccountTrigger`: trigger entry point。
- `AccountTriggerHandler`: trigger context の振り分け。
- `AccountTriggerService`: Account trigger の処理順序、変更判定、業務ロジックの入口。
- `AccountTriggerSelector`: Account trigger のために必要な SOQL。
- `TestDataFactory`: trigger / service test 用のテストデータ作成。

### クラス分割の考え方

- 最初から 1 処理 1 クラスにしない。
- 小さい処理は `AccountTriggerService` に置く。
- 複雑化した処理だけ専用クラスへ切り出す。
- trigger 外でも使う処理は、trigger 名を含まない service / domain へ昇格する。
- before / after service は、処理量が増えてから検討する。

### Selector の考え方

最初から `AccountSelector` / `ContactSelector` のようなオブジェクト単位 selector に寄せると、Account trigger の改修時に関連クエリを探しにくくなる可能性がある。

Account trigger の処理で使う SOQL は、まず `AccountTriggerSelector` に置く。
Contact や Opportunity を取得する場合でも、Account trigger のための取得であれば `AccountTriggerSelector` に置く。

別 trigger や別 service でも同じ取得が必要になった場合に、共通 selector への切り出しを検討する。

### テスト構成

```text
AccountTriggerHandlerTest
AccountTriggerServiceTest
AccountTriggerSelectorTest
TestDataFactory
```

- `AccountTriggerHandlerTest`: trigger 経由の代表シナリオ。
- `AccountTriggerServiceTest`: 業務ロジックの主テスト。
- `AccountTriggerSelectorTest`: selector が複雑化した場合に追加。
