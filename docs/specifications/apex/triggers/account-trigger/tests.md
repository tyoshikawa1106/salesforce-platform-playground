# 取引先トリガーのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

- `AccountTriggerHandlerTest` で、before insert、before update、Triggerの実行単位をまたぐ一括登録をTrigger経由で確認すること
- `AccountTriggerServiceTest` で、名称変更判定、空入力、更新前レコードが取得できない場合をService単位で確認すること
- `AccountTriggerHandlerTest` で、定義済みの株式会社略称と有限会社略称が正式名称へ置換されること
- 前方、途中、後方にある略称の位置を保って置換されること
- 1つの名称に複数の略称が含まれる場合にすべて置換されること
- 略称を含まない名称が変更されないこと
- `AccountTriggerServiceTest` で、Name未変更、null、空白、空リスト、更新前レコード不在を安全に処理すること

## 対応するテストクラス

- [AccountTriggerHandlerTest.cls](../../../../../force-app/main/default/classes/AccountTriggerHandlerTest.cls)
- [AccountTriggerServiceTest.cls](../../../../../force-app/main/default/classes/AccountTriggerServiceTest.cls)
