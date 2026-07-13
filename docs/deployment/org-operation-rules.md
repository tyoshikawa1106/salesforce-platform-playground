# 組織操作ルール

この文書は、AI エージェントが接続中の Salesforce 組織へ validate / deploy / test / retrieve を実行するときの判断の起点です。
実行コマンドの暗記ではなく、対象 org、scope、検証結果、報告内容を取り違えないための運用ルールとして扱います。

## この文書の責務

この文書は、接続中の Salesforce 組織に対する次の事項を一元管理します。

- 操作対象となる org と alias
- deploy / retrieve scope
- validate、deploy、retrieve、Apex test の実行条件
- PR マージ前の事前検証とマージ後 deploy
- 実行結果と未実行項目の報告

GitHub Flow、PR 作成、マージの承認境界は [GitHub 運用ルール](../development/github-rules.md) に従います。GitHub 運用ルールから参照された場合も、Salesforce 組織操作の詳細はこの文書を正とします。

## 操作種別と参照先

Salesforce 組織操作を依頼されたら、最初に対象を切り分けます。

| 対象                                                     | 参照先                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 接続中の組織に対する validate / deploy / retrieve / test | このページ                                                                          |
| Scratch Org の作成・再現                                 | [Scratch Org 再現ルール](scratch-org-rebuild-rules.md)                              |
| Scratch Org からの変更取り込み                           | [Scratch Org manifest 運用ルール](scratch-org-manifest-rules.md)                    |
| metadata の削除                                          | [メタデータ削除ルール](metadata-deletion-rules.md)。別タスクとして扱う              |
| テストデータ投入                                         | [テストデータ投入手順](test-data-import.md)。dry-run とクリーンアップ方針を確認する |
| GitHub Actions の Salesforce validate 設定               | [CI メタデータ検証ルール](ci-metadata-validation-rules.md)                          |

## 共通実行ルール

- validate / deploy / test / retrieve は、確認済みの Salesforce 組織に対してのみ実行する。
- 対象 org が個別指定されていない場合は、現在の default target org を確認して対象にする。
- default target org の切り替え忘れによる誤実行を避けるため、Salesforce 組織操作では確認済みの alias を `--target-org <alias>` で明示する。
- 明示依頼なしに default target org を切り替えない。
- `sf project deploy preview` 前提で進めず、差分確認と対象組織に応じた validate または dry-run を標準の確認手段にする。
- Production 組織と、このリポジトリで実行確認済みの Developer Edition の Dev 組織では `sf project deploy validate` を使う。Sandbox と Scratch Org では `sf project deploy start --dry-run` を使う。
- login URL だけで組織種別や利用可能な事前検証を判断しない。対象 org または CI 接続先を変更する場合は、組織種別と利用するコマンドを確認してから運用へ組み込む。
- deploy 前に validate、dry-run、または同等の事前検証を実行し、どれを使ったかを報告する。
- `sf project deploy validate` は反映前チェックであり、ユーザーが動作確認できる状態とは扱わない。
- `force-app` 全体には Settings、Profile、ManagedContentType、使用中 EntitlementProcess など、全体 deploy に向かない metadata も含まれるため、標準検証の起点にはしない。
- `manifest/rebuild-developer-org.xml` は接続中の Salesforce 組織への初回デプロイ / 再構築 scope として扱う。
- `npm run sf:validate:dev` と `npm run sf:deploy:dev` は `manifest/rebuild-developer-org.xml` を使う標準コマンドとして扱う。
- 変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞る。
- 通常開発では、PR の deploy 可能な変更が選んだ scope にすべて含まれることを確認し、validate とマージ後 deploy に同じ scope を使う。標準 manifest に含まれない変更は、作業対象 manifest または `--metadata` で補う。
- org 側の retrieve 結果が `Changed` でも、その表示だけで repo 反映を判断しない。Git 差分を確認して、対象外差分や空白差分を除外する。
- `sf org display --json` など token を含み得る出力は、必要性が明確な場合だけ使う。報告や docs に token、実ユーザー名、org 固有 URL を残さない。
- 本番環境への deploy は、ユーザーが本番リリースを明示した場合だけ実行する。

## 判断順序

Salesforce 組織操作を行う前に、次の順で判断します。

1. 依頼範囲が validate / deploy / retrieve / test / data import / destructive changes のどれかを切り分ける。
2. 対象 org alias を確認する。個別指定がない場合は、現在の default target org を確認して使う。
3. PR または作業差分に含まれる deploy 可能な metadata を列挙し、すべてを含む deploy / retrieve scope を manifest、`--metadata`、または script の設定で決める。
4. Git 差分と選んだ scope を照合し、deploy 対象の漏れ、対象外の metadata、org 固有値が混ざっていないことを確認する。
5. 対象組織の種別に応じて、deploy 前に validate、dry-run、または script の dry-run を実行する。
6. 実行結果、対象 org alias、未実行の確認と理由を報告する。

## 対象組織

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf config get target-org
```

対象 org の個別指定がない場合は、この default target org を対象にします。後続の validate / deploy / retrieve / test コマンドでは、取得した alias を `--target-org <alias>` で明示します。

alias だけでは判断できない場合に限り、必要な範囲で `sf org display --target-org <alias>` を使います。報告には対象組織の alias を含め、実ユーザー名や org 固有 URL は書きません。

## PR マージ前の事前検証

Salesforce メタデータ変更を含む PR をマージする前に、現在の default target org を対象に、PR の deploy 可能な変更をすべて含む scope で validate または dry-run を実行します。

```sh
sf config get target-org
npm run sf:validate:dev -- --target-org <alias>
```

この標準コマンドは Production 組織と、このリポジトリで実行確認済みの Developer Edition の Dev 組織で使います。Sandbox と Scratch Org では、同じ scope を指定して次を実行します。

```sh
sf project deploy start --dry-run --manifest manifest/rebuild-developer-org.xml --test-level RunLocalTests --target-org <alias> --wait 30
```

`<alias>` は `sf config get target-org` で確認した default target org alias に置き換えます。PR の変更がすべて標準 manifest に含まれる場合だけ、選んだコマンドをその PR 全体の事前検証として扱います。含まれない変更は、作業対象 manifest または `--metadata` を使って同じ対象 org で確認します。
default target org が未設定、認証切れ、または対象として不適切と判断できる場合はマージせず、必要な対象 org / 確認方針をユーザーに報告します。

## 実行手順

### Validate

接続中の Production 組織または実行確認済みの Developer Edition の Dev 組織では、初回デプロイ / 再構築前にメタデータの整合性を確認します。

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

Sandbox と Scratch Org では `sf project deploy validate` の代わりに `sf project deploy start --dry-run` を使い、同じ scope と test level を指定します。

PR 前の確認では、変更内容に応じて validate または dry-run に加えて LWC test、Code Analyzer、Apex test を実行します。
PR ブランチでは実 deploy せず、マージ前の validate または dry-run を最終判定として扱います。通常の Apex / Salesforce メタデータ開発では、マージ後に同期した作業ツリーがクリーンな `main` から、事前検証を実行した同じ対象 org へ同じ scope で実 deploy します。

### CI validate

GitHub Actions の `npm checks` は、Salesforce JWT 認証用の Secrets が揃っている場合だけ Salesforce 組織 validate を実行します。
Secrets が未設定の場合は、Salesforce validate を skip して CI は成功扱いにします。

CI の Secrets、Connected App、`ci-dev` alias の詳細は [CI メタデータ検証ルール](ci-metadata-validation-rules.md) に分けます。
AI エージェントがローカル deploy / retrieve / test を実行するときは、CI 用の `ci-dev` alias ではなく、依頼範囲の対象 org alias を確認して `--target-org <alias>` で明示します。

### Deploy

初回デプロイ / 再構築で validate または dry-run が成功したら、同じ確認済みの組織へ反映します。
通常開発で Salesforce メタデータ変更を含む PR をマージした場合は、ローカルの `main` を `origin/main` と同期し、作業ツリーがクリーンで `HEAD` と `origin/main` が一致することを確認してから、事前検証に成功した同じ対象 org へ同じ scope で実 deploy します。Salesforce メタデータ変更を含む PR のマージ依頼は、このマージ後 deploy まで含むものとして扱います。

```sh
npm run sf:deploy:dev -- --target-org <alias>
```

この script は次の manifest deploy を実行します。

```sh
sf project deploy start --manifest manifest/rebuild-developer-org.xml --target-org <alias>
```

PR の deploy 可能な変更がすべて標準 manifest に含まれる場合は、`npm run sf:deploy:dev` を使います。含まれない変更がある場合は、その変更をすべて含む作業対象 manifest または `--metadata` をvalidateとdeployの両方で使います。
validate の job id を使って quick deploy する場合も、対象 org alias を明示し、元の validate 結果と deploy 結果を両方報告します。

マージ後は deploy 結果で成功、対象件数、エラー、テスト結果を確認します。org と Git の一致確認が必要な変更では、同じ scope を retrieve し、実質差分がないことも確認します。deploy と必要な一致確認が成功するまで、その Salesforce 開発タスクは完了扱いにしません。deploy に失敗した場合は、原因を修正する後続 PR または取り消しの要否を判断し、未反映の状態を報告します。

次の場合はマージ後 deploy の対象外です。

- docs-only PR
- 対象 org から retrieve した状態だけを Git へ同期し、org へ戻す変更を含まない retrieve-only PR
- ユーザーが本番リリースを明示していない本番環境

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
