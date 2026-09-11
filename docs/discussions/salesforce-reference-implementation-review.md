# Salesforce 参照実装の課題整理

## 検討時点と目的

検討時点: 2026-09-12。確認対象のコミットは `505e24381fb7e2bfc36c31626622766bde0710cd`。

他の Salesforce 開発プロジェクトで実装方針を参考にできる状態を目指し、独自実装、関連仕様、テスト、運用スクリプト、依存関係の課題を整理した記録です。現行仕様・開発ルールの正本や、改修の決定事項ではありません。

ソースの静的確認、既存ローカルテスト、CLI を模擬した再現結果を区別しています。この調査では Salesforce 組織への deploy、retrieve、Apex テスト、実データ変更、Chrome による操作検証を行っていません。全標準設定の意味的監査や全テスト本文の逐一確認が完了したという記録ではありません。

## 対応不要とした項目

### 並行変換の出力混在（CONVERSION-1）

[Permission Set 変換処理](../../scripts/permissionset-conversion/convert-profile-to-permissionset.js)は、出力先の存在を確認してから確認入力を待ち、後でディレクトリを作成します。保存ファイルの排他的作成はありますが、実行単位のディレクトリを排他的に確保していません。

同じ時刻、異なるライセンスと入力を使った二つの `main` 呼び出しを、CLI と確認入力を模擬して並行実行したところ、両方が成功し、同じ出力ディレクトリへ保存されました。各実行が案内する deploy コマンドは、他方の出力も含むディレクトリを対象にします。実際の deploy は行っていません。

当初の修正候補は実行ディレクトリの排他的確保でした。

**結論（2026-09-12）: 対応不要。** 通常運用は一人が手動で順番に実行することを前提とし、同じミリ秒に出力先を選ぶ並行実行への対応は求めません。再現は時刻を固定した模擬実行によるもので、実運用での発生実績は確認していません。優先修正候補および今回の完了条件から除外し、この項目のための実装変更・回帰テスト追加は行いません。同時実行をサポートする要件が生じた場合に再評価します。

### 削除 manifest の事前検証（DESTRUCTIVE-1）

[削除処理](../../scripts/metadata/destructive/destructive.js)がコメント内の `types`、数値文字参照で表したワイルドカード `&#42;`、閉じていない不正な XML を事前検証で受理することを、読み込み内容を差し替えたローカル関数呼び出しで確認しました。これは実際の誤削除を示す結果ではありません。後段には対象 org の確認と dry-run があり、dry-run の失敗時は実削除へ進みません。

**結論（2026-09-12）: 対応不要。** 指摘した特殊な入力への追加対策は通常運用で必要とせず、ローカルのエラー判定強化は過剰と判断しました。優先修正候補および今回の完了条件から除外し、この項目のための XML 解析変更・追加エラー判定・回帰テスト追加は行いません。既存の事前検証と dry-run は維持します。

### 取得 manifest の事前検証（RETRIEVE-1）

- [取得処理](../../scripts/metadata/retrieve/retrieve.js): コメント内の `types` を取得対象と認識し、有効な対象を持たない manifest を受理することをローカルで確認しました。

XML の構造に基づく検証が当初の修正候補でした。実際の retrieve は行っておらず、通常の正しい manifest による取得障害は確認していません。

**結論（2026-09-12）: 対応不要。** 特殊な入力に対するエラー判定の追加は通常運用で必要とせず、過剰と判断しました。優先修正候補および今回の完了条件から除外し、この項目のための XML 解析変更・追加エラー判定・回帰テスト追加は行いません。既存の事前検証は維持します。

### 任意オブジェクトの seed 続行（SEED-3）

[WorkOrder seed](../../scripts/apex/test-data/seed-standard-work-orders.apexpart)は利用できないオブジェクトを省略しますが、続く [WorkOrderLineItem seed](../../scripts/apex/test-data/seed-standard-work-order-line-items.apexpart)は任意オブジェクトの利用可否より先に親データの存在を検査します。親を省略し、既存の対象親データもない条件では後続処理が停止します。

これは、[テストデータ投入手順](../deployment/test-data-import.md)の任意オブジェクトを省略して続行する説明との不整合です。当初は親子双方の省略条件を揃える案と、任意の EmailMessage seed と後続の専用 seed の関係を確認する案を挙げました。静的確認であり、対象 org では再現していません。

**結論（2026-09-12）: 対応不要。** 作業指示を利用できない組織でも一括投入を続行させるための変更は、今回の対応対象に含めません。作業指示と親データが正常に作成される環境では、この停止条件は成立しません。優先修正候補および今回の完了条件から除外し、この項目のための seed 変更・追加検証・回帰テスト追加は行いません。記載した条件付きの制約は調査記録として残します。

### エラーと空結果の同時表示（UI-2）

[検索ロジック](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchLogic.js)は失敗時に行を空にし、[テンプレート](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearch.html)はエラーと空結果を独立した条件で表示します。静的には検索失敗と「結果なし」の案内が同時に成立します。ブラウザでは再現していません。

当初は成功した空結果と取得失敗を区別する表示変更を提案しました。

**結論（2026-09-12）: 対応不要。** 通常利用での発生や支障は確認しておらず、この表示改善は今回の対応対象に含めません。Chrome の Offline 設定は通信失敗を意図的に作る再現手段であり、その操作だけが発生条件という意味ではありません。優先修正候補および今回の完了条件から除外し、この項目のための表示変更・追加再現検証・回帰テスト追加は行いません。

### スキャン結果の共有範囲（DQ-1 の参照範囲）

**結論（2026-09-12）: 現行の共有仕様を維持する。** DataQualityScan__c の参照権限を持つ利用者に同じ最新結果を表示することは意図した動作であり、依頼者本人だけへの絞り込みは不要です。参照権限のない利用者に結果を取得させないことを条件とします。

権限制御は LWC 内の独自判定ではなく、Apex Selector の `WITH USER_MODE` により取得時のオブジェクト権限・項目権限・共有を適用しています。取得に失敗した場合は Controller がエラーを返します。この仕組みはソースで確認しており、今回の検討では権限不足ユーザーによる org 上の検証は行っていません。LWC は再取得失敗時に取得済みの結果を保持するため、表示後の権限変更で既表示データを即時消去する保証とは区別します。

この結論は結果の参照範囲についてのものであり、進捗情報の編集権限の変更要否は別の判断事項です。

### 編集フォームのレコードタイプ判定（FORM-1）

作成・編集のレイアウトは利用者の既定レコードタイプから取得しています。

**結論（2026-09-12）: 現状維持。** 編集対象レコードに応じたレコードタイプ判定は追加しません。この項目のためのフォーム変更・回帰テスト追加は行わず、今回の完了条件から除外します。

### 削除 manifest の確認から実行までの同一性（DESTRUCTIVE-2）

現行処理は manifest を一度検証し、確認入力、dry-run、deploy に同じファイルパスを使います。途中で内容が変更される場合への追加対策を検討事項としていましたが、同時編集による実害は確認していません。

**結論（2026-09-12）: 対応不要。** 一時ファイルへのコピーによる対象固定、スナップショット、ハッシュ等による内容比較は追加しません。現行の manifest を使う手順を維持し、この同一性確保のための実装変更・回帰テスト追加は今回の完了条件から除外します。

### サンプルWebLink（METADATA-1）

[Case.UpsellCrosssellOpportunity](../../force-app/main/default/objects/Case/webLinks/UpsellCrosssellOpportunity.webLink-meta.xml) のURLには `https://na1.salesforce.com/opp/oppedit.jsp` が直接設定されています。ApexやLWCが付与する値ではありません。

**結論（2026-09-12）: サンプルWebLink全体を対応不要とする。** `Account.Billing`、`Case.UpsellCrosssellOpportunity`、`Opportunity.DeliveryStatus` はいずれも現状維持とし、URL変更、レイアウトからの除外、再構築manifestからの除外は行いません。METADATA-1全体を今回の修正対象・完了条件から除外します。

### Trailhead向けのユーザー名変更禁止ルール

[User.NoUsernameChangesAllowed](../../force-app/main/default/objects/User/validationRules/NoUsernameChangesAllowed.validationRule-meta.xml) は、Userオブジェクトの入力規則です。ソースでは `active=true` となっています。

- 判定式は `Username != PRIORVALUE(Username)` で、ログイン用の `Username` が変更された場合にエラーとします。氏名や表示名の変更を禁止する規則ではありません。
- エラー表示先は `Username` 項目です。エラー文言は `Please do not change usernames in the Trailhead Playground.` です。
- 定義の説明には、ユーザー名変更がTrailheadからの自動ログインに影響する可能性があるため、と記載されています。
- [Scratch Org再構築manifest](../../manifest/rebuild-scratch-org.xml) に `User.NoUsernameChangesAllowed` が含まれるため、そのmanifestを使う再構築ではこの規則も反映対象になります。

**結論（2026-09-12）: 現状維持。** 入力規則を有効な定義のまま保持し、Scratch Org再構築対象にも残します。業務プロジェクトへ転用するときに同じ制約が必要か再判断できるよう、目的と適用範囲を記録として残します。確認したのはリポジトリの定義であり、現在の接続組織での有効状態や保存時の挙動は検証していません。

### READMEでの再利用範囲の説明

当初は、汎用の実装方針とPlayground固有設定の適用範囲を既存の入口で説明する案を挙げました。コードの不具合や仕様との矛盾ではなく、利用者向けの案内追加の提案でした。

**結論（2026-09-12）: 説明追加は不要。README.mdは現状維持。** 再利用範囲を説明する情報は追加しません。README.mdは情報量を削減する方向で今後見直す予定とし、今回の記録作業では削減も実施しません。

### 適用条件・検証不足

**結論（2026-09-12）: 記載された条件と検証範囲を了承し、この区分について追加対応は行わない。** 対象は次の内容です。

- 大量の既存seedデータで、削除と再作成の合計がDML行数上限に達する条件。
- 複数通貨が無効である現行設定と、複数通貨・Person Account・異なるレコードタイプへの転用条件。
- 権限テストの細かな拡充は不要とし、Apexテストは原則システム管理者で実行する方針。
- ローカルテスト成功だけでは、実組織の権限・適合性・障害復旧を証明しないという検証範囲。
- 共有定義等の構造確認と、全標準設定・実効権限の意味的確認の範囲の違い。
- 文書チェックは構造検査であり、仕様と実装の意味的一致を保証しないという制約。

この区分を理由に、実装変更・テスト拡充・追加のorg検証・全体監査・説明文書の追加を行いません。未確認の内容を確認済みに変更するものではなく、制約は記録として保持します。別途作成済みのIssue #768・#769の対応方針と、その変更に必要な検証は維持します。

## 対応方針を決めた事項

### スキャン機能の参照権限不足時の表示と操作

**結論（2026-09-12）: 取引先の参照権限がない場合は、取引先データ品質スキャンのLWCにエラーメッセージを表示し、スキャン操作をできなくする。** 結果保存先の DataQualityScan__c の参照権限がない利用者にも結果を取得・表示させません。必要な参照権限を持つ利用者には、実行者本人に限定せず同じ最新結果を表示する現行の共有方針を維持します。

改修方針と完了条件は [Issue #768](https://github.com/tyoshikawa1106/salesforce-platform-playground/issues/768) に整理しました。既存の状態取得と開始処理で参照可否を扱い、LWCの権限不足表示・結果表示・開始操作を制御します。サーバー側の USER_MODE / as user も維持します。権限不足と、権限ありの履歴なし・対象0件を区別して検証します。

対象は `accountDataQualityScan` と関連Apex・テスト・仕様です。データボードの件数カードや編集フォームのレコードタイプ判定は対象外です。この段階では方針の記録のみで、実装は変更していません。

### Scratch Org初期反映のdry-run前提記載（SCRATCH-1）

**結論（2026-09-12）: 運用文書の「dry-runを実行し、成功してからdeployする」という初期反映の記載を削除する。** 一括セットアップ全体の説明の移動・集約や、スクリプトへのdry-run追加は行いません。

[Issue #769](https://github.com/tyoshikawa1106/salesforce-platform-playground/issues/769) に、`scratch-org-manifest-rules.md` と `scratch-org-rebuild-rules.md` の初期反映における事前dry-runの説明・コマンドと、dry-run成功をdeployの前提とする文言の削除を記録しました。deploy自体の説明、RunLocalTests要件、失敗時の後続停止は維持します。仕様書への集約・参照リンクへの置き換えは対象外です。通常開発やscope変更時の個別検証は変更しません。Issue訂正時点では運用文書の修正未着手です。

## 設計として決める事項

| ID | 確認した状態 | 判断する内容 |
| --- | --- | --- |
| DQ-1（編集権限） | Account と DataQualityScan__c の内部共有はともに ReadWrite。進捗項目の編集権限も付与する。 | 参照範囲は現行維持で決定済み。進捗更新主体と編集権限の変更要否は別途判断する。 |
| DQ-2 | Finalizer の失敗記録と実行中キー解除も利用者権限による参照・更新に依存する。 | 実行途中にその権限を失った場合、誰がどの経路で復旧するか。無条件に system mode へ変更する案ではない。 |
| METRICS-1 | データボードは参照不能・利用不能・個別 QueryException を0件として扱う。仕様も同じ。 | 変更要否は未決定。スキャン機能の権限不足時の操作抑止とは別項目であり、Issue #768の対象外。 |

確認先:

- [スキャン仕様](../specifications/lwc/account-data-quality-scan/index.md)、[Queueable / Finalizer](../../force-app/main/default/classes/AccountDataQualityScanQueueable.cls)、[Selector](../../force-app/main/default/classes/AccountDataQualityScanSelector.cls)、[Service](../../force-app/main/default/classes/AccountDataQualityScanService.cls)
- [データボード仕様](../specifications/lwc/object-metrics-overview/index.md)、[集計 Selector](../../force-app/main/default/classes/ObjectMetricsOverviewSelector.cls)
- [レコード操作仕様](../specifications/lwc/object-record-search/record-operations.md)、[検索 LWC](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearch.js)
- [Scratch Org deploy 処理](../../scripts/scratch-org/steps/deploy.js)、[一括管理仕様](../specifications/scripts/scratch-org-management/index.md)、[再現ルール](../deployment/scratch-org-rebuild-rules.md)、[manifest ルール](../deployment/scratch-org-manifest-rules.md)

## 権限テストの評価（TEST-1）

**結論（2026-09-12）: レビュー指摘として対応不要。** このリポジトリのApexテストは、原則としてシステム管理者ユーザーでの実行を前提とします。機能ごとに明示された場合だけ、特定権限のユーザーを `System.runAs` で指定するテストを用意する方針です。このリポジトリでは、そのためのユーザー作成・権限付与やCRUD / FLS / 共有の細かな組み合わせのテストを追加しません。

機能本体の権限チェックとエラー処理は維持し、正常系、エラー時の応答、LWCの表示・操作抑止を確認します。Issue #768もこの方針に合わせ、権限別ユーザーで実効権限の許可・拒否を再現することは完了条件にしません。必要なエラー応答の確認にはmock等を用い、実組織の権限設定を再現した検証とは区別します。

以下は調査時点の証拠の範囲を残した記録であり、追加対応を求める一覧ではありません。テスト実装や実行ユーザー設定は、この記録作業では変更していません。

| 対象 | 現在の証拠 | 検証不足 |
| --- | --- | --- |
| テストユーザー | TestDataFactory は実行ユーザーを返す。スキャン用ユーザーは実行者の Profile を継承し、Permission Set を追加する。 | 対象権限が不足する条件を固定していない。 |
| 検索・削除 | 本体には USER_MODE があり、Controller は模擬した内部例外の一般化を検証する。 | 実際の CRUD / FLS 拒否や共有による不可視を検証した証拠とは異なる。 |
| 削除失敗 | 削除済みレコードの再削除で失敗件数を確認する。 | 削除権限不足による拒否は別の条件。 |
| PDF | USER_MODE で必要項目を取得し、正常、null、削除済み ID を検証する。 | 必要項目を参照できない場合の拒否と利用者向け応答。 |
| スキャン復旧 | mock の FinalizerContext を渡し、失敗記録とキー解除を確認する。 | 実際の非同期障害、管理レコードの参照・更新権限喪失からの復旧。 |

確認先: [TestDataFactory](../../force-app/main/default/classes/TestDataFactory.cls)、[検索エラーテスト](../../force-app/main/default/classes/ObjectRecordSearchControllerErrorTest.cls)、[削除 Service テスト](../../force-app/main/default/classes/ObjectRecordSearchServiceTest.cls)、[PDF Selector テスト](../../force-app/main/default/classes/AccountPdfSelectorTest.cls)、[Queueable テスト](../../force-app/main/default/classes/AccountDataQualityScanQueueableTest.cls)。

## 転用条件と境界

| ID | 確認した状態・制約 | 次の確認 |
| --- | --- | --- |
| SEED-1 | 専用 Case / EmailMessage seed は削除と再作成を同じトランザクションで行う。大量の既存データでは合計 DML 行数が上限を超える条件がある。 | 条件を了承し、追加対応不要。通常件数の再生成で上限超過を確認したわけではない。 |
| SEED-2 | 価格表 seed の既存価格選択は Product2Id 単位で通貨を区別しない。商談商品との通貨整合も明示しない。 | 現行 Currency 設定は複数通貨無効。転用条件を了承し、追加対応不要。 |
| TRIGGER-1 | Account.Name の文字列置換が文字数を増やす場合があり、Person Account を明示的には除外しない。 | 項目最大長付近と Person Account の適用可否。現行の不具合としては未立証。 |

確認先: [関連 Case seed](../../scripts/apex/test-data/seed-case-related-case-list.apex)、[EmailMessage seed](../../scripts/apex/test-data/seed-case-email-message-list.apex)、[標準価格表 seed](../../scripts/apex/test-data/seed-standard-pricebook-entries.apexpart)、[Account Trigger Service](../../force-app/main/default/classes/AccountTriggerService.cls)、[再構築 manifest](../../manifest/rebuild-scratch-org.xml)。

Playground 固有設定の転用可否は個別に判断します。この説明をREADME.mdへ追加する案は採用せず、現状維持とします。

## 不具合と断定しない確認事項

| ID | 懸念 | 判定に不足する根拠 |
| --- | --- | --- |
| SEARCH-1 | 既存カーソルと変更後の条件を直接 Apex に渡せる。Case EmailMessage も CaseId とカーソルを別々に受け取る。 | 標準カーソルの契約と直接呼び出しの保証範囲。LWC は条件変更時にカーソルを初期化する。権限回避は立証していない。 |
| DELETE-1 | 削除 API に要求 ID 数の明示的な上限がない。 | UI のページサイズと独立した直接呼び出しの対応範囲。現行 UI の障害は未再現。 |
| UI-1 | caseContactProfile / caseRelatedCaseList は recordId 変更後、wire 応答まで旧表示が残る可能性がある。 | 実際の画面遷移とフレームワークの応答順。静的な懸念だけで確定しない。 |
| RETRIEVE-2 | 成功 envelope 内の Failed ファイルに診断文やパスがない模擬応答を成功と分類する。 | 実際の Salesforce CLI がこの応答を返すか。mock 上の不足を実障害と混同しない。 |

確認先: [検索 Selector](../../force-app/main/default/classes/ObjectRecordSearchSelector.cls)、[検索 Controller](../../force-app/main/default/classes/ObjectRecordSearchController.cls)、[Case EmailMessage Controller](../../force-app/main/default/classes/CaseEmailMessageController.cls)、[caseContactProfile](../../force-app/main/default/lwc/caseContactProfile/caseContactProfile.js)、[caseRelatedCaseList](../../force-app/main/default/lwc/caseRelatedCaseList/caseRelatedCaseList.js)、[取得処理](../../scripts/metadata/retrieve/retrieve.js)。

## 依存関係・文書・回帰テスト

- **DEPS-1**: [ESLint 設定](../../eslint.config.js)が直接 import する `@eslint/js` と `globals` は [package.json](../../package.json)の直接依存にありません。現在は推移的依存として利用でき、lint は成功しています。更新時の依存責務を明確にする保守候補です。
- 調査時の npm audit は既知脆弱性の指摘なし、open PR もなしでした。将来の状態や未知の脆弱性の不存在を保証しません。
- ESLint 10.10.0 は更新候補でしたが、導入済み Salesforce / LWC / Aura 関連パッケージは ESLint 9 を要求しており、単独更新の互換性はありません。
- lint-staged は 17.4.1 から 17.5.1 が更新候補でした。[17.5.0](https://github.com/lint-staged/lint-staged/releases/tag/v17.5.0)は intent-to-add の明示的拒否、ローカル実行ファイル解決などの修正、[17.5.1](https://github.com/lint-staged/lint-staged/releases/tag/v17.5.1)は TypeScript の defineConfig 宣言修正です。package.json 内の現行設定は TypeScript 修正の直接対象ではありません。通常の更新評価候補とし、導入・フック検証は行っていません。
- [データボード仕様](../specifications/lwc/object-metrics-overview/index.md)に記載された `ObjectMetricsOverviewQueryCoordinatorTest` は存在せず、実際は [ObjectMetricsQueryCoordinatorTest](../../force-app/main/default/classes/ObjectMetricsQueryCoordinatorTest.cls)です。**結論（2026-09-12）: 仕様書のクラス名を訂正する。** 文書修正の [Issue #769](https://github.com/tyoshikawa1106/salesforce-platform-playground/issues/769) に追加しました。Apexクラスの改名やSOQL残枠のテスト追加はこの訂正に含めません。
- 同 Coordinator の残り SOQL 枠不足を事前拒否する経路に専用の回帰テストが見当たりません。Service の計画数上限超過テストとは別の経路です。これはテスト追加候補であり、実装不具合が再現したという意味ではありません。

## 確認できた実装と証拠の限界

- 検索の固定カタログ、bind、USER_MODE、標準 PaginationCursor、決定的ソート、取得位置、部分削除は関連仕様と一致しました。ページングテストには全 ID・順序比較、カーソル JSON 往復、先頭への復帰があります。
- データボードの件数クエリ、SOQL 枠の事前確認、表示上限、個別失敗の0件扱いは仕様と一致しました。
- スキャンの通常状態遷移、一意な実行中キー、分割処理は仕様と一致しました。権限喪失時の復旧は別の判断事項です。
- 選択した LWC Jest、運用スクリプトの Node.js テスト、文書検査、lint・整形確認はローカルで成功しました。これらを現在の組織の権限・実動作・非同期障害からの復旧の証拠とはしません。
- 構造解析した共有ルールは空定義でした。オブジェクト共有値と関連設定も確認しましたが、全設定の意図や実組織の実効権限は未確認です。
- 調査時の詳細ログはローカル一時領域にあり、この文書には同梱していません。上記の再現条件とソース参照を判断材料として残し、改修時には回帰テストと実行ログを保存し直す必要があります。

## 対応順と完了判断

1. 出力混在（CONVERSION-1）、削除 manifest の事前検証（DESTRUCTIVE-1）、取得 manifest の事前検証（RETRIEVE-1）、任意オブジェクトの seed 続行（SEED-3）、エラーと空結果の同時表示（UI-2）、編集フォームのレコードタイプ判定（FORM-1）、削除 manifest の同一性確保（DESTRUCTIVE-2）は対応不要・現状維持の判断により除外する。
2. スキャン機能の参照権限不足は、スキャンLWCのエラー表示と操作抑止の方針に沿って扱う。依存宣言、文書誤記と不足する回帰テストは対象別に扱う。
3. 結果の参照範囲は現行維持とする。「適用条件・検証不足」は追加対応不要として完了条件から除外する。その他の未決定事項は個別に判断し、追加対応を自動で開始しない。
4. Scratch Org初期反映の「dry-run成功後にdeployする」という記載はIssue #769で運用文書から削除する。一括セットアップ全体の説明は移動・集約しない。必要な仕様整合と、対象変更に応じた CI・組織検証・GitHub 反映の証拠を揃える。

確認済みの課題が残るため、参照実装として完成したとは判断していません。完了条件は「将来一切問題が見つからないこと」ではなく、採用範囲の課題解消、回帰証拠、仕様との整合、適用条件と未確認範囲の明示です。本記録だけを根拠に実装や開発ルールを変更するものではありません。

## 改修対象の確定（2026-09-12）

採用する改修は、Issue #768の取引先データ品質スキャンの参照権限不足時のエラー表示・操作抑止と、Issue #769のScratch Org初期反映のdry-run前提記載の削除・データボード仕様書のテストクラス名訂正とします。この記録と索引を同じPRへ含めます。

対応不要・現状維持とした項目や、了承済みの適用条件・検証不足は、追加修正や追加テストの完了条件にしません。権限別ユーザーの組み合わせを再現するテストは追加せず、本体の権限判定と、拒否応答時の表示・操作抑止を確認します。実装・検証・マージの結果は対応PRに記録します。
