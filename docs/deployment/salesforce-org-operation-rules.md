# Salesforce 組織操作ルール

この文書は、AI エージェントが接続中の Salesforce 組織へ validate / deploy / test / retrieve を実行するときの判断の起点です。
実行コマンドの暗記ではなく、対象 org、scope、検証結果、報告内容を取り違えないための運用ルールとして扱います。

Scratch Org の作成・初期反映は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md) を参照します。
destructive changes は [Salesforce メタデータ削除ルール](salesforce-org-destructive-changes-rules.md) を参照します。
テストデータ投入は [テストデータ投入手順](test-data-import.md) を参照します。
GitHub Actions での任意 Salesforce validate 設定は [CI Salesforce validate ルール](ci-salesforce-validate-rules.md) を参照します。

## 最初に判断すること

Salesforce 組織操作を依頼されたら、AI エージェントは最初に対象を切り分けます。

- 接続中の Salesforce 組織へ validate / deploy / retrieve / test する場合は、このページに従う。
- Scratch Org の作成・再現は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md)、Scratch Org から変更を戻す場合は [Scratch Org manifest 運用ルール](scratch-org-manifest-rules.md) に従う。
- metadata 削除は [Salesforce メタデータ削除ルール](salesforce-org-destructive-changes-rules.md) として別タスクで扱う。
- テストデータ投入は [テストデータ投入手順](test-data-import.md) に従い、dry-run と cleanup 方針を確認する。
- GitHub Actions の Salesforce validate 設定は [CI Salesforce validate ルール](ci-salesforce-validate-rules.md) に従う。

## 共通実行ルール

- validate / deploy / test / retrieve は、確認済みの Salesforce 組織に対してのみ実行する。
- 対象 org が個別指定されていない場合は、現在の default target org を確認して対象にする。
- default target org の切り替え忘れによる誤実行を避けるため、Salesforce 組織操作では確認済みの alias を `--target-org <alias>` で明示する。
- 明示依頼なしに default target org を切り替えない。
- `sf project deploy preview` 前提で進めず、差分確認と validate を標準の確認手段にする。
- deploy 前に `sf project deploy validate`、dry-run、または同等の preflight を実行する。どれを使ったかを報告する。
- `sf project deploy validate` は反映前チェックであり、ユーザーが動作確認できる状態とは扱わない。
- `force-app` 全体には Settings、Profile、ManagedContentType、使用中 EntitlementProcess など、全体 deploy に向かない metadata も含まれるため、標準検証の起点にはしない。
- `manifest/rebuild-developer-org.xml` は接続中の Salesforce 組織への初回デプロイ / 再構築 scope として扱う。
- `npm run sf:validate:dev` と `npm run sf:deploy:dev` は `manifest/rebuild-developer-org.xml` を使う標準コマンドとして扱う。
- 変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞る。
- org 側の retrieve 結果が `Changed` でも、その表示だけで repo 反映を判断しない。Git 差分を確認して、対象外差分や空白差分を除外する。
- `sf org display --json` など token を含み得る出力は、必要性が明確な場合だけ使う。報告や docs に token、実ユーザー名、org 固有 URL を残さない。
- 本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行する。

## 判断順序

Salesforce 組織操作を行う前に、次の順で判断します。

1. 依頼範囲が validate / deploy / retrieve / test / data import / destructive changes のどれかを切り分ける。
2. 対象 org alias を確認する。個別指定がない場合は、現在の default target org を確認して使う。
3. deploy / retrieve scope を manifest、`--metadata`、または script の設定で絞る。
4. Git 差分を確認し、対象外の metadata や org 固有値が混ざっていないことを確認する。
5. deploy 前に validate、dry-run、または script の dry-run を実行する。
6. 実行結果、対象 org alias、未実行の確認と理由を報告する。

## 対象組織

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf config get target-org
```

対象 org の個別指定がない場合は、この default target org を対象にします。ただし後続の validate / deploy / retrieve / test コマンドでは、取得した alias を `--target-org <alias>` で明示します。

alias だけでは判断できない場合に限り、必要な範囲で `sf org display --target-org <alias>` を使います。報告には対象組織の alias を含め、実ユーザー名や org 固有 URL は書きません。

## PR merge 前 validate

Salesforce メタデータ変更を含む PR を merge する前に、現在の default target org を対象に validate します。

```sh
sf config get target-org
npm run sf:validate:dev -- --target-org <alias>
```

`<alias>` は `sf config get target-org` で確認した default target org alias に置き換えます。
default target org が未設定、認証切れ、または対象として不適切と判断できる場合は merge せず、必要な対象 org / 確認方針をユーザーに報告します。

## 実行手順

### Validate

接続中の Salesforce 組織の初回デプロイ / 再構築では、反映前にメタデータの整合性を確認します。

```sh
npm run sf:validate:dev -- --target-org <alias>
```

この script は次の manifest validate を実行します。

```sh
sf project deploy validate --manifest manifest/rebuild-developer-org.xml --test-level RunLocalTests --target-org <alias>
```

validate が失敗した場合は、失敗理由と対象ファイルを確認し、必要な修正だけを行います。
`sf project deploy validate --source-dir force-app` の失敗は、広く retrieve した org 固有 metadata の混入確認として扱い、通常作業の失敗判定にはしません。
変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って validate します。

PR 前の確認では、変更内容に応じてこの validate に加えて LWC test、Code Analyzer、Apex test を実行します。
Salesforce 組織へ永続反映する deploy は、ユーザーの明示依頼または repo の運用ルールで要求される場合だけ実行します。通常の Apex / Salesforce メタデータ開発では、PR 作成前に、validate に成功した同じ対象 org への実 deploy まで完了します。
PR 作成前の deploy は開発完了確認として扱い、merge 前 validate は merge 直前の最終 gate として扱います。

### CI validate

GitHub Actions の `npm checks` は、Salesforce JWT 認証用の Secrets が揃っている場合だけ Salesforce 組織 validate を実行します。
Secrets が未設定の場合は、Salesforce validate を skip して CI は成功扱いにします。

CI の Secrets、Connected App、`ci-dev` alias の詳細は [CI Salesforce validate ルール](ci-salesforce-validate-rules.md) に分けます。
AI エージェントがローカル deploy / retrieve / test を実行するときは、CI 用の `ci-dev` alias ではなく、依頼範囲の対象 org alias を確認して `--target-org <alias>` で明示します。

### Deploy

初回デプロイ / 再構築で validate が成功したら、同じ確認済みの組織へ反映します。
通常開発で PR を作成する場合も、PR 作成前に、validate に成功した同じ対象 org へ実 deploy します。

```sh
npm run sf:deploy:dev -- --target-org <alias>
```

この script は次の manifest deploy を実行します。

```sh
sf project deploy start --manifest manifest/rebuild-developer-org.xml --target-org <alias>
```

変更範囲を狭く反映したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って deploy します。
validate の job id を使って quick deploy する場合も、対象 org alias を明示し、元の validate 結果と deploy 結果を両方報告します。

### Apex test

Apex クラスやトリガーを含む PR を作成する前に、関連 Apex テストを coverage 付きで実行します。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human --target-org <alias>
```

コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

## 報告ルール

メタデータ変更後は次を報告します。

- 対象 Salesforce 組織の alias
- 実行した validate / deploy / test
- Apex テストの成功件数と coverage
- 実行しなかった確認と、その理由
