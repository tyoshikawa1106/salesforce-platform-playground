# AI エージェントスキルでできること

`.agents/skills/` は、Salesforce 関連作業で AI エージェントが参照する Git 管理された作業手順集です。
このリポジトリでは `forcedotcom/sf-skills` 由来のスキルを、実装方針、確認観点、コマンド例、レビュー観点の補助として扱います。

プロジェクト固有の判断、運用ルール、検証条件は `AGENTS.md` と `docs/` を優先します。
Skills 内の手順は、deploy、retrieve、データ変更、認証操作などの実行権限を拡張しません。

## 主な用途

| 領域                    | できること                                                                                                                                    | 主なスキル                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apex                    | Apex クラス、トリガー、テスト、ログ解析、テスト実行、カバレッジ確認の観点を参照する。                                                         | `platform-apex-generate`, `platform-apex-test-generate`, `platform-apex-test-run`, `platform-apex-logs-debug`                                                                                                                                          |
| Salesforce メタデータ   | Custom Object、Custom Field、Permission Set、Validation Rule、Tab、FlexiPage、Lightning App、List View、Flow などの生成や確認観点を参照する。 | `platform-custom-object-generate`, `platform-custom-field-generate`, `platform-permission-set-generate`, `platform-validation-rule-generate`, `platform-flexipage-generate`, `automation-flow-generate`, `platform-lightning-app-coordinate`           |
| デプロイと org 操作     | Metadata deploy / validate、target org 切り替え、Code Analyzer 実行の手順や確認観点を参照する。                                               | `platform-metadata-deploy`, `dx-org-switch`, `dx-code-analyzer-run`                                                                                                                                                                                    |
| SOQL とデータ操作       | SOQL / SOSL の作成、最適化、Salesforce データ操作、Data Cloud schema / query の確認観点を参照する。                                           | `platform-soql-query`, `platform-data-manage`, `data360-schema-get`, `data360-query`                                                                                                                                                                   |
| LWC と UI               | LWC、SLDS、SLDS 2 移行、モバイル対応、アクセシビリティ、UI bundle の設計と確認観点を参照する。                                                | `experience-lwc-generate`, `design-systems-slds-apply`, `design-systems-slds-validate`, `design-systems-slds2-migrate`, `mobile-platform-offline-validate`, `experience-ui-bundle-*`                                                                   |
| Salesforce 公式情報     | Salesforce 公式ドキュメント、Help、開発者向けリファレンス、SLDS などを根拠として取得する手順を参照する。                                      | `platform-docs-get`                                                                                                                                                                                                                                    |
| インテグレーション      | Named Credentials、External Credentials、External Services、OAuth、Connected App、Managed Event Subscription などの設計観点を参照する。       | `integration-connectivity-generate`, `integration-connectivity-connected-app-configure`, `integration-eventing-subscription-configure`                                                                                                                 |
| Agentforce              | Agentforce の開発、テスト、観測、アーキテクチャ調査、D360 調査の観点を参照する。                                                              | `agentforce-generate`, `agentforce-test`, `agentforce-observe`, `agentforce-architecture-analyze`, `agentforce-d360-analyze`                                                                                                                           |
| Data Cloud              | Connect、Prepare、Harmonize、Segment、Act の各フェーズと横断オーケストレーションの確認観点を参照する。                                        | `data360-orchestrate`, `data360-connect`, `data360-prepare`, `data360-harmonize`, `data360-segment`, `data360-activate`                                                                                                                                |
| OmniStudio / Industries | OmniScript、FlexCard、Integration Procedure、Data Mapper、DataPack、EPC catalog、Callable Apex の設計と検証観点を参照する。                   | `omnistudio-omniscript-generate`, `omnistudio-flexcard-generate`, `omnistudio-integration-procedure-generate`, `omnistudio-datamapper-generate`, `omnistudio-datapacks-deploy`, `omnistudio-epc-catalog-generate`, `omnistudio-callable-apex-generate` |
| Commerce / CMS / media  | B2B Commerce store、open code components、CMS brand、media search、visual diagram生成の作業観点を参照する。                                   | `commerce-b2b-store-create`, `commerce-b2b-open-code-components-integrate`, `experience-cms-brand-apply`, `experience-content-media-search`, `external-diagram-mermaid-generate`                                                                       |

## 使い方の位置づけ

- スキルは、AI エージェントが作業前に読む補助手順として使う。
- スキル内の例やコマンドは、そのまま採用せず、このリポジトリのルールと現在の org / GitHub / repo 状態に合わせて判断する。
- Apex、LWC、メタデータ、org 操作を伴う作業では、関連する `docs/development/` と `docs/deployment/` のルールを先に確認する。
- Salesforce 公式情報を調べる作業では、`platform-docs-get` を使い、第三者記事より公式ドキュメントを優先する。
- `.agents/skills/` と `skills-lock.json` は外部取得物として Git 管理し、更新時は両方の差分を Pull Request で確認する。

## 現在参照できるカテゴリ

| カテゴリ                    | スキル例                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apex / test / log           | `platform-apex-generate`, `platform-apex-test-generate`, `platform-apex-test-run`, `platform-apex-logs-debug`                                                                |
| Metadata generation         | `platform-custom-*-generate`, `platform-flexipage-generate`, `automation-flow-generate`, `platform-list-view-generate`, `platform-lightning-app-coordinate`                  |
| Deploy / quality            | `platform-metadata-deploy`, `experience-ui-bundle-deploy`, `dx-code-analyzer-run`, `dx-org-switch`                                                                           |
| LWC / SLDS / mobile         | `experience-lwc-generate`, `design-systems-slds-*`, `mobile-platform-native-capabilities-integrate`, `mobile-platform-offline-validate`                                      |
| UI bundles                  | `experience-ui-bundle-app-coordinate`, `experience-ui-bundle-frontend-generate`, `experience-ui-bundle-*-generate`, `experience-ui-bundle-salesforce-data-access`            |
| Data Cloud                  | `data360-orchestrate`, `data360-connect`, `data360-prepare`, `data360-harmonize`, `data360-segment`, `data360-activate`, `data360-query`                                     |
| Agentforce                  | `agentforce-generate`, `agentforce-test`, `agentforce-observe`, `agentforce-architecture-analyze`, `agentforce-d360-analyze`                                                 |
| OmniStudio / Industries     | `omnistudio-*-generate`, `omnistudio-datapacks-deploy`, `omnistudio-dependencies-analyze`                                                                                    |
| Integration / auth / events | `integration-connectivity-generate`, `integration-connectivity-connected-app-configure`, `integration-eventing-subscription-configure`, `integration-eventing-cdc-configure` |
| Docs / media / brand        | `platform-docs-get`, `experience-content-media-search`, `experience-cms-brand-apply`, `external-diagram-mermaid-generate`                                                    |
