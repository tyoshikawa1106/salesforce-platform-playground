# Scratch Org管理スクリプト

## 概要

設定ファイルに従ってScratch Orgの作成、metadata反映、Permission Set割り当て、Apexテスト、テストデータ投入を順番に行い、明示されたaliasのScratch Orgを削除するNode.jsスクリプトです。

## 目的・利用場面

このリポジトリの開発・確認環境をScratch Orgへ再現するときと、確認済みのScratch Orgを削除するときに使用します。

## 対象実装・メタデータ

| 種別             | パス                                                                                      | 役割                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Node.js script   | `scripts/scratch-org/setup.js`                                                            | 作成した組織のユーザー名で準備stepを順番に実行する       |
| Node.js script   | `scripts/scratch-org/delete.js`                                                           | 明示されたaliasのScratch Orgを削除する                   |
| 設定             | `scripts/scratch-org/scratch-org.json`                                                    | 既定alias、期間、manifest、ECA、権限、待機時間を定義する |
| Node.js modules  | `scripts/scratch-org/internal/`                                                           | alias引数、共通設定、終了状態を処理する                  |
| step scripts     | `scripts/scratch-org/steps/`                                                              | 作成、反映、ECA、権限、データ投入を個別実行する          |
| Permission Set   | `force-app/main/default/permissionsets/ScratchOrgMetadataDeployer.permissionset-meta.xml` | 初期反映の実行者へポリシー反映権限を付与する             |
| manifest         | `manifest/rebuild-scratch-org.xml`                                                        | 初期metadata反映scopeを定義する                          |
| Scratch定義      | `config/project-scratch-def.json`                                                         | Scratch Orgのedition、features、settingsを定義する       |
| テストスクリプト | `scripts/scratch-org/test/*.node.js`                                                      | 引数、step順序、CLI引数、manifest整合を検証する          |

ECAの反映処理は`steps/deploy-external-client-apps.js`、パッケージの検証と組織固有値の置換は`internal/eca-package.js`、資格情報の登録は`internal/eca-provider-credentials.js`が担当します。いずれも`scripts/scratch-org/`配下にあります。ECAと関連メタデータの反映範囲は`manifest/rebuild-scratch-org-external-client-apps.xml`、プロバイダー名からECA名への対応は`scratch-org.json`の`externalClientAppProviders`を正とします。名前が同じであることは前提にしません。

## 入力

準備は次の形式で実行します。

```sh
node scripts/scratch-org/setup.js [--alias <alias>]
```

alias未指定時は`scratch-org.json`の既定値を使用します。削除では対象の取り違えを避けるため、aliasを必須とします。

```sh
node scripts/scratch-org/delete.js --alias <alias>
```

各コマンドは `--help` または `-h` で使用方法を表示します。初期反映の `steps/deploy.js` は `--alias` と `--shells-only` を受け付けます。

## 処理内容

### Scratch Orgの準備

1. `sf org create scratch`でScratch定義、alias、有効日数を指定して作成する。一括実行ではJSON応答から新しい組織のユーザー名を取得し、作成に失敗した場合やユーザー名を取得できない場合は停止する。
2. CLIの認証済み組織一覧で対象が一意のScratch Orgであることを確認し、そのusernameを接続先に固定する。`deploymentPermissionSet`に指定した権限セットだけを`NoTestRun`でdeployし、同じ実行者への割り当てを確認し、未割り当ての場合だけ付与してから、`manifest/rebuild-scratch-org.xml`を`NoTestRun`と設定済み待機時間でdeployする。
3. `externalClientAppManifest` に指定されたローカルのECAメタデータを変換する。ECA本体、OAuth定義、外部認証IDプロバイダー、指定ログイン情報はGit管理対象外のため、一括実行の前にmanifestに記載された定義をローカルへ用意する。外部認証IDプロバイダーは`force-app/main/default/externalAuthIdentityProviders/`に配置する。取得した定義をそのまま使用し、接続先の変換は一時パッケージに限定する。一時パッケージでは、関連する認可URL、トークンURL、コールバックURL、指定ログイン情報の接続元が一致することを確認し、作成先のMy Domainへ差し替える。取得元のアプリ識別子、OAuthコンシューマー識別子、資格情報は一時パッケージから除く。`externalClientAppLabels` に指定したアプリの表示名は、一時パッケージでのみ差し替える。個人取引先が有効な組織では、初期反映・OAuth 反映ともに、一時パッケージで取引先参照に必要な取引先責任者の参照権限を補う。アプリの枠だけを作成する場合は初期反映の `deploy.js` に `--shells-only` を指定し、外部認証プリンシパルを除いた両画面の権限セットを初期反映してから[個別のCLI手順](../../../deployment/scratch-org-rebuild-rules.md#external-client-app-の扱い)を使う。作成aliasに対応する標準システム管理者をClient Credentials Flowの実行ユーザーとして一時パッケージに設定し、接続設定のURLを同じ組織のMy Domainに差し替え、全Client Credentials Flowの有効設定を保持し、ECA本体・接続定義を反映し、同じScratch Orgで生成されたOAuthポリシーを一時領域へ取得する。ECA参照から生成済みポリシーのAPI名を一意に照合し、その実名を使ってポリシーを更新する。プリンシパル利用権限を持つ`LwcExternalClientAppManager`と`LwcObjectExplorer`は接続定義と同じ段階で反映する。対応設定に従ってECAの鍵とシークレットを同じ組織の認証プロバイダーへ登録し、新規登録はPOST、登録済みはPUTを使う。Scratch OrgのREST APIによるシークレット参照が無効なら、資格情報登録時だけ有効にしてから元の設定に戻す。反映または資格情報登録が失敗した場合は後続を実行しない。
4. `scratch-org.json`の`permissionSets`に列挙したPermission Setを、同じScratch Orgの作成ユーザーへ割り当てる。有効な直接割り当てを確認し、不足分だけを付与する。共通アプリ用の`SalesforceApplicationUser`と、各LWCのApex入口・タブ・必要なカスタム権限を持つ`Lwc`プレフィックスの権限セットを対象にする。オブジェクトや項目の権限は各機能の既存設定に従う。オブジェクトエクスプローラーの分類変更には、別途標準の`CustomizeApplication`が必要で、この割り当てでは付与しない。CLIへ`--name`を繰り返し指定し、`--json`で結果を表示する。一部でも失敗した場合は非0終了し、後続のテストデータ投入を実行しない。
5. オブジェクトエクスプローラーのテストに必要な取引先項目の参照権限は、作成ユーザーに割り当てる権限セットで確保する。権限セット割り当て後、同じScratch Orgの作成ユーザーで`RunLocalTests`を実行して完了まで監視する。失敗時はテストデータ投入へ進まない。
6. 共通のテストデータ投入スクリプトへ作成結果のユーザー名、import plan、投入stepで定義した繰り返し回数を渡す。標準データの投入が成功し、対象がScratch Orgと確認できた場合は、同じ組織の確認済みユーザーをロール・ユーザーデータ作成処理へ内部的に引き継ぐ。追加投入でも種別を再判定し、接続先を表示して作成確認を求める。

作成後の各stepは子Node.jsプロセスとして順番に実行し、非0終了した時点で後続stepを実行しません。テストデータ投入stepでは接続組織を表示し、利用者の承認後に投入します。

deploy stepを単独で実行した場合も同じ組織種別の確認を行います。本番、Developer Edition、Sandbox、対象不明、CLI取得失敗、不完全な応答ではdeployを実行せず非0終了します。

反映用権限セットには`ModifyTransactionSecurityPolicies`だけを含めます。管理者の既存の`CustomizeApplication`と合わせ、manifest内の`TransactionSecurityPolicy`を反映できる状態にします。アプリ利用者向けの権限セットには追加しません。割り当ては一時的ではなく、再実行に備えてScratch Orgの実行管理者に残します。権限セットを再反映しても、割り当て済みの場合は重複割り当てを行わないため、deploy stepは同じ組織へ再実行できます。割り当て確認に失敗した場合も後続処理を停止します。権限セット反映または割り当てに失敗した場合はmanifest反映へ進みません。

### ECA反映の検証と一時ファイル

ECAとOAuth設定・ポリシーの参照、Client Credentials Flowの設定整合、認証プロバイダーの対応漏れ、外部ログイン情報と指定ログイン情報の参照先を、反映前に検証します。ローカルの定義へコンシューマ鍵・シークレットや取得元組織のOAuth linkが混入している場合は停止します。対象組織の接続先を使うプロバイダーだけに、その組織の資格情報を登録します。

OSの一時ディレクトリ配下に実行ごとの`scratch-org-eca-`接頭辞を持つ作業ディレクトリを作り、`base/`に本体・接続定義、`policies/`にOAuthポリシー、`generated/`に対象組織から取得した生成済みポリシーを置きます。Git管理のXMLは変更せず、組織のURL、実行ユーザー、プロファイルによる事前承認を一時成果物だけに設定します。成功・失敗ともに`finally`で一時ディレクトリを削除します。プロセスの強制終了やOS停止では削除を保証できません。

資格情報はCLIの標準入出力のパイプとプロセスのメモリで扱い、引数・ファイル・通常ログには書きません。全アプリの資格情報と全プロバイダーの登録状態を確認してから書き込みます。登録途中の失敗では後続処理を停止し、同じ組織で再実行したときに登録状態を再確認します。反映済みの組織設定は自動で取り消しません。

### Scratch Orgの削除

検証済みのaliasを`sf org delete scratch --target-org <alias>`へ渡します。`--no-prompt`を指定しないため、Salesforce CLIの削除確認が表示されます。

## 出力・更新対象

- 準備処理はScratch Orgを作成し、metadata、Permission Set、テストデータを反映します。
- 削除処理はSalesforce CLIで確認されたScratch Orgを削除します。
- setup開始時に作成用のaliasを表示します。権限セットの割り当ては単独実行でもScratch Orgであることを確認し、そのユーザー名へ割り当てます。
- 失敗時は停止したstep名と子プロセスの終了コードを返します。

## 権限・実行条件

- Node.jsとSalesforce CLIを利用でき、Scratch Orgを作成できるDev Hubが設定されている必要があります。
- Scratch定義のfeatureと設定がDev Hubで利用できる必要があります。
- metadata反映、Permission Set割り当て、Apexテスト、テストデータ投入に必要な権限が必要です。
- 削除は利用者が対象を確認し、明示依頼した場合だけ実行します。

## エラー処理

- alias引数が不正な場合はSalesforce CLIを実行せず、エラーと使用方法を表示します。
- 準備stepが失敗した場合は後続stepを実行しません。
- 途中失敗時も、作成済みScratch Org、反映済みmetadata、割り当て済み権限、投入済みデータを自動でロールバックまたは削除しません。
- テストデータ投入の承認拒否は投入を行わず正常終了するため、setup全体も正常終了します。

## 関連コンポーネント

- [Scratch Org再現ルール](../../../deployment/scratch-org-rebuild-rules.md)
- [Scratch Org再現の前提と設定](../../../deployment/scratch-org-rebuild-reference.md)
- [Scratch Org manifest運用ルール](../../../deployment/scratch-org-manifest-rules.md)
- [Scratch Org definition featureルール](../../../deployment/scratch-org-definition-feature-rules.md)
- [テストデータ投入スクリプト](../test-data-import/index.md)

## テスト・確認観点

`scripts/scratch-org/test/*.node.js`で、alias、help、例外、step順序、失敗時停止、Salesforce CLI引数、設定参照、反映権限の範囲、権限準備からmanifest反映までの順序と各段階の失敗時停止、再構築manifestとGit管理sourceの整合を確認します。

```sh
node --test scripts/scratch-org/test/*.node.js
```

## 制約・注意事項

- setupはpackage installを実行しません。必要なpackageはmetadata反映前に個別にインストールします。
- setupはmetadata deploy前のdry-runを自動実行しません。再構築scopeを変更した場合は運用ルールに従って別途確認します。
- setupはDefault Target Orgを変更せず、作成応答で確定したユーザー名を後続stepへ渡します。
- Scratch Orgは接続中のSalesforce組織と完全一致する環境ではありません。
- 実行時にDev組織へ接続してメタデータを取得する処理はありません。Dev組織でアプリを増減した場合は、組織固有値を除いたXML、専用manifest、必要なプロバイダー対応を更新します。件数や個別アプリ一覧を文書へ転記する必要はありません。
- 本人認証のBrowser Flowでは、資格情報の登録後も利用者自身のOAuth認証が必要です。

## 既知の差異・確認事項

- 状態: 未確認
- Client Credentials Flowの作成管理者指定は、対象組織でのポリシー反映とトークン取得で確認します。API Only権限を管理者に自動付与しません。
- Node.jsテストではSalesforce CLIと子プロセスを模擬しています。Scratch Orgの作成からデータ投入までの実動作は、対象Dev Hubのfeature、package、metadata、権限に依存します。
