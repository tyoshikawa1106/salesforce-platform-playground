# Test Fixture Factory 命名

## 位置づけ

この文書は、Apex テストで再利用するテストデータ作成クラスの命名について、`TestDataFactory`、`CommonTester`、`FixtureFactory` を比較した判断過程をまとめたものです。

決定済みルールではなく、今後の Apex テスト基盤を整えるときの検討メモとして扱います。

## 背景

`TestDataFactory` は、Apex テストで使う SObject のテストデータを作成するクラス名として意味が明確です。

一方で、対応するテストクラスを `TestDataFactoryTest` にすると、先頭と末尾の両方に `Test` が入り、名前としてくどく見える課題があります。

```text
TestDataFactory
TestDataFactoryTest
```

テストデータ作成クラス自体にもテストが必要です。ここが落ちると、利用側のテスト失敗が、対象クラスの問題なのかテストデータ作成基盤の問題なのか切り分けにくくなります。

## 候補

### TestDataFactory / TestDataFactoryTest

役割はもっとも明確です。

- テストデータを作るクラスだと初見で分かる。
- Apex テストの一般的な命名として自然。
- ただし `Test...Test` になり、名前の見た目が重い。

### TestDataFactory / TestDataFactoryContractTest

`Factory` の利用契約を検証する意図は表せます。

- `create` は未保存レコードを返す。
- `insert` は保存済みレコードを返す。
- 関連レコードの参照が正しく張られる。

ただし、先頭と末尾に `Test` が残るため、`Test...Test` を避けたいという課題の根本解決にはなりません。

### CommonTester / CommonTesterTest

語感は良く、`Test...Test` も避けられます。

ただし、`Common` と `Tester` は意味が広く、テストデータ作成以外の共通処理を吸い寄せやすい名前です。

この名前を採用する場合は、PR レビューで責務の逸脱を止める前提になります。

### FixtureFactory / FixtureFactoryTest

`fixture` は、テストを実行するために用意するデータや状態を指すテスト用語です。

Apex では、テスト用の `Account`、`Contact`、`Opportunity`、`Product2` などの SObject が fixture に当たります。

```text
FixtureFactory
FixtureFactoryTest
```

- `Test...Test` のくどさを避けられる。
- `CommonTester` より責務が狭く、データ作成クラスだと分かりやすい。
- `TestDataFactory` よりはテスト用語に寄るため、`fixture` の意味を知らない読み手には少し分かりにくい。

## 現時点の判断

意味の明確さだけなら `TestDataFactory` が強いです。

一方で、`TestDataFactoryTest` という名前のくどさを避けたい場合は、`FixtureFactory / FixtureFactoryTest` が最もバランスの良い候補です。

`FixtureFactory` は、テスト用の前提データを作るクラスという意味を保ちながら、`CommonTester` より責務を広げにくい名前です。

## 一般性

Apex / Salesforce 文脈では、テストデータ作成クラス名としては `TestDataFactory` のほうが一般的です。

よく見かける候補は次のような名前です。

- `TestDataFactory`
- `TestDataBuilder`
- `TestUtil` / `TestUtils`
- `TestFactory`

`FixtureFactory` は、Apex 固有の定番名というより、テスト一般の用語に寄った名前です。

Rails、Django、pytest、Jest などの文脈では、`fixture` はテストを実行するためのデータや状態を指す用語として自然に使われます。一方で、Apex 初心者や Salesforce 専門の読み手には、`TestDataFactory` のほうが直感的に伝わります。

そのため、選び方は次のように整理できます。

- Apex での一般性を重視するなら `TestDataFactory`。
- テスト用語としての自然さと `Test...Test` 回避を重視するなら `FixtureFactory`。
- このリポジトリ内の語感と責務のバランスを重視するなら、`FixtureFactory` は採用候補にできる。

## テストで確認したい契約

`FixtureFactory` を採用する場合、専用テストでは coverage 目的ではなく、テストデータ作成基盤の契約を確認します。

- `createXxx` は未保存レコードを返す。
- `insertXxx` は保存済みレコードを返す。
- `Contact`、`Opportunity`、`OpportunityLineItem` などの親子関係が正しく張られる。
- `PricebookEntry` と `OpportunityLineItem` が Salesforce の制約を満たして作成できる。
