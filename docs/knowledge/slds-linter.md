# SLDS Linter

SLDS Linterは、Lightningコンポーネントのマークアップとスタイルを静的解析し、Salesforce Lightning Design System（SLDS）のルールに沿っていない実装を検出するnpmパッケージです。

Salesforce公式ガイドでは、組み込みのSLDS 2ルールによる検査、修正候補の提示、リポジトリ単位のautofixに対応するツールとして説明されています。SLDS 1、SLDS 2、SLDS 1からSLDS 2への移行中のコードで、UIに関する違反を見つけるために利用できます。

## 対応するファイル

SLDS Linterは、次のLightningコンポーネントファイルを検査します。

| コンポーネント | 対象ファイル |
| -------------- | ------------ |
| LWC            | HTML、CSS    |
| Aura           | CMP、CSS     |

JavaScriptの処理やApexはSLDS Linterの対象ではありません。このリポジトリでは、独自実装しているLWCを対象にします。

```text
force-app/main/default/lwc
```

## 主な検査内容

インストールしているルールでは、主に次を検査します。

- 色、余白、サイズなどのハードコード値
- SLDS 2で非推奨となったクラス
- 従来のLWC Design TokenからSLDS Styling Hookへの移行候補
- 独自CSSによる`.slds-*`クラスの上書き
- 未対応またはprivateなStyling Hook、fallbackの不足
- custom hookのnamespaceや命名規則
- HTMLでのBEMクラス利用やmodal close buttonの構造

検査結果は修正候補であり、機械的に置き換えるだけでは十分でない場合があります。対象コンポーネントの設計、見た目、状態変化を確認してから修正します。

## このリポジトリでの実行方法

最初に、lockfileに固定された依存を再現します。

```sh
npm ci
```

SLDS Linterは、次のnpm scriptから実行します。

```sh
npm run lint:slds
```

このnpm scriptは、次のコマンドを実行します。

```sh
slds-linter lint force-app/main/default/lwc
```

ローカルとGitHub Actionsは同じnpm scriptを使います。`npx @salesforce-ux/slds-linter@latest`は実行時に外部取得やversion変更が発生し得るため、通常の検証には使用しません。

## 結果の読み方

違反がない場合は、検査したstyle fileとcomponent fileの件数に続いて`No SLDS Violations found.`と表示されます。

違反がある場合は、対象ファイル、行、列、rule、指摘内容を確認します。対応後は`npm run lint:slds`を再実行し、違反が解消したことを確認します。

違反を解消するために、無断でruleの無効化、suppression、対象範囲の縮小を行いません。コードまたは設計で解消できない場合は、理由と影響を整理して対応方針を確認します。

## autofixの扱い

SLDS Linter自体は`--fix`による一括修正に対応していますが、このリポジトリの標準scriptには`--fix`を付けていません。

autofixはLWCのHTMLやCSSを書き換えるため、実行する場合は対象範囲を確認し、差分、見た目、動作への影響をレビューします。LWC metadataを変更した場合のdeployと動作確認は、[AI エージェント開発ルール](../development/agent-development-rules.md)と[組織操作ルール](../deployment/org-operation-rules.md)に従います。

## 他の品質チェックとの役割分担

| 確認手段                     | 主な役割                                                  |
| ---------------------------- | --------------------------------------------------------- |
| ESLint                       | Aura / LWC JavaScriptの構文とコード品質                   |
| SLDS Linter                  | LightningコンポーネントのHTML / CMP / CSSとSLDS準拠       |
| Salesforce Code Analyzer     | ApexやFlowを含むSalesforce sourceの静的解析               |
| LWC Jest                     | LWCの状態変化、イベント、表示内容などの動作確認           |
| UI・アクセシビリティ実機確認 | 見た目、キーボード操作、screen reader、contrastなどの確認 |

SLDS Linterで違反が0件でも、画面の見た目、レスポンシブ表示、操作性、アクセシビリティが正しいことまでは保証されません。Jest、アクセシビリティテスト、Salesforce組織上の動作確認と組み合わせます。

## 公式情報

- [SLDS Linter](https://developer.salesforce.com/docs/platform/slds-linter/overview) - Salesforce Developer Guideの概要ページ
- [Get Started with SLDS Linter](https://developer.salesforce.com/docs/platform/slds-linter/guide/get-started-intro.html) - 導入から検査、autofixまでの公式ワークフロー
- [SLDS Linter Commands](https://developer.salesforce.com/docs/platform/slds-linter/guide/reference-commands.html) - CLIコマンドとoption
- [SLDS Linter Rules](https://developer.salesforce.com/docs/platform/slds-linter/guide/reference-rules.html) - 組み込みruleの一覧
