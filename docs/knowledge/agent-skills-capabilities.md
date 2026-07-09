# AI エージェントスキルでできること

`.agents/skills/` は、Salesforce 関連作業で AI エージェントが参照するローカルの作業手順集です。
このリポジトリでは `forcedotcom/sf-skills` 由来のスキルを、実装方針、確認観点、コマンド例、レビュー観点の補助として扱います。

プロジェクト固有の判断、運用ルール、検証条件は `AGENTS.md` と `docs/` を優先します。
`.agents/skills/` がない環境でも作業を止めず、必要な場合だけローカルに導入します。

## 主な用途

| 領域                    | できること                                                                                                                                    | 主なスキル                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apex                    | Apex クラス、トリガー、テスト、ログ解析、テスト実行、カバレッジ確認の観点を参照する。                                                         | `generating-apex`, `generating-apex-test`, `running-apex-tests`, `debugging-apex-logs`                                                                                                  |
| Salesforce メタデータ   | Custom Object、Custom Field、Permission Set、Validation Rule、Tab、FlexiPage、Lightning App、List View、Flow などの生成や確認観点を参照する。 | `generating-custom-object`, `generating-custom-field`, `generating-permission-set`, `generating-validation-rule`, `generating-flexipage`, `generating-flow`, `generating-lightning-app` |
| デプロイと org 操作     | Metadata deploy / validate、Scratch Org、target org 切り替え、Code Analyzer 実行の手順や確認観点を参照する。                                  | `deploying-metadata`, `switching-org`, `running-code-analyzer`                                                                                                                          |
| SOQL とデータ操作       | SOQL / SOSL の作成、最適化、Salesforce データ操作、Data Cloud schema / query の確認観点を参照する。                                           | `querying-soql`, `handling-sf-data`, `getting-datacloud-schema`, `retrieving-datacloud`                                                                                                 |
| LWC と UI               | LWC、SLDS、SLDS 2 移行、モバイル対応、アクセシビリティ、UI bundle の設計と確認観点を参照する。                                                | `generating-lwc-components`, `applying-slds`, `validating-slds`, `uplifting-components-to-slds2`, `reviewing-lwc-mobile-offline`, `building-ui-bundle-*`                                |
| Salesforce 公式情報     | Salesforce 公式ドキュメント、Help、開発者向けリファレンス、SLDS などを根拠として取得する手順を参照する。                                      | `fetching-salesforce-docs`                                                                                                                                                              |
| インテグレーション      | Named Credentials、External Credentials、External Services、OAuth、Connected App、Managed Event Subscription などの設計観点を参照する。       | `building-sf-integrations`, `configuring-connected-apps`, `managing-managed-event-subscription`                                                                                         |
| Agentforce              | Agentforce の開発、テスト、観測、アーキテクチャ調査、D360 調査の観点を参照する。                                                              | `developing-agentforce`, `testing-agentforce`, `observing-agentforce`, `investigating-agentforce-architecture`, `investigating-agentforce-d360`                                         |
| Data Cloud              | Connect、Prepare、Harmonize、Segment、Act の各フェーズと横断オーケストレーションの確認観点を参照する。                                        | `orchestrating-datacloud`, `connecting-datacloud`, `preparing-datacloud`, `harmonizing-datacloud`, `segmenting-datacloud`, `activating-datacloud`                                       |
| OmniStudio / Industries | OmniScript、FlexCard、Integration Procedure、Data Mapper、DataPack、EPC catalog、Callable Apex の設計と検証観点を参照する。                   | `building-omnistudio-*`, `deploying-omnistudio-datapacks`, `modeling-omnistudio-epc-catalog`, `building-omnistudio-callable-apex`                                                       |
| Commerce / CMS / media  | B2B Commerce store、open code components、CMS brand、media search、visual diagram 生成の作業観点を参照する。                                  | `creating-b2b-commerce-store`, `integrating-b2b-commerce-open-code-components`, `applying-cms-brand`, `searching-media`, `generating-visual-diagrams`                                   |

## 使い方の位置づけ

- スキルは、AI エージェントが作業前に読む補助手順として使う。
- スキル内の例やコマンドは、そのまま採用せず、このリポジトリのルールと現在の org / GitHub / repo 状態に合わせて判断する。
- Apex、LWC、メタデータ、org 操作を伴う作業では、関連する `docs/development/` と `docs/deployment/` のルールを先に確認する。
- Salesforce 公式情報を調べる作業では、`fetching-salesforce-docs` を使い、第三者記事より公式ドキュメントを優先する。
- `.agents/skills/` と `skills-lock.json` はローカル生成物として扱い、通常は Git 管理しない。

## 現在参照できるカテゴリ

| カテゴリ                    | スキル例                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apex / test / log           | `generating-apex`, `generating-apex-test`, `running-apex-tests`, `debugging-apex-logs`                                                                                    |
| Metadata generation         | `generating-custom-*`, `generating-flexipage`, `generating-flow`, `generating-list-view`, `generating-lightning-app`                                                      |
| Deploy / quality            | `deploying-metadata`, `deploying-ui-bundle`, `running-code-analyzer`, `switching-org`                                                                                     |
| LWC / SLDS / mobile         | `generating-lwc-components`, `applying-slds`, `validating-slds`, `uplifting-components-to-slds2`, `using-mobile-native-capabilities`                                      |
| UI bundles                  | `building-ui-bundle-app`, `building-ui-bundle-frontend`, `generating-ui-bundle-*`, `using-ui-bundle-salesforce-data`                                                      |
| Data Cloud                  | `orchestrating-datacloud`, `connecting-datacloud`, `preparing-datacloud`, `harmonizing-datacloud`, `segmenting-datacloud`, `activating-datacloud`, `retrieving-datacloud` |
| Agentforce                  | `developing-agentforce`, `testing-agentforce`, `observing-agentforce`, `investigating-agentforce-*`                                                                       |
| OmniStudio / Industries     | `building-omnistudio-*`, `deploying-omnistudio-datapacks`, `analyzing-omnistudio-dependencies`, `modeling-omnistudio-epc-catalog`                                         |
| Integration / auth / events | `building-sf-integrations`, `configuring-connected-apps`, `managing-managed-event-subscription`                                                                           |
| Docs / media / brand        | `fetching-salesforce-docs`, `searching-media`, `applying-cms-brand`, `generating-mermaid-diagrams`, `generating-visual-diagrams`                                          |
