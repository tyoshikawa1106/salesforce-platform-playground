# 機能仕様書ルール

AI エージェントが機能仕様書を追加、更新、分割するときは、このルールに従います。

## 基本方針

- 機能仕様書には、リポジトリで開発、管理している機能の現在の仕様と仕組みを記載する。
- 実装から確認できる振る舞いを記載し、実装変更と同じ変更で関連する仕様書も更新する。
- 実装予定、検討中の内容、判断過程は仕様として固定せず、必要に応じて `docs/discussions/` に置く。
- Salesforce や開発技術に関する汎用的な説明は `docs/knowledge/` に置く。
- 機能名、ページタイトル、リンク表示名は、日本語だけで役割を把握できる表現にする。
- API名、クラス名、実際の画面表示、メタデータの状態値は、コード表記または日本語訳との併記で残す。

## 仕様書の単位

主仕様書は、処理の入口となるメタデータごとに最初から専用ディレクトリを作り、`index.md` として配置します。

| 種別           | 主仕様書の単位                  | 配置                                                       |
| -------------- | ------------------------------- | ---------------------------------------------------------- |
| Flow           | Flow ファイル                   | `docs/specifications/flows/<flow>/index.md`                |
| LWC            | 独立した機能を提供するBundle    | `docs/specifications/lwc/<bundle>/index.md`                |
| Aura           | Aura Component Bundle           | `docs/specifications/aura/<bundle>/index.md`               |
| Visualforce    | Visualforce Page                | `docs/specifications/visualforce/<page>/index.md`          |
| Apex Trigger   | Trigger ファイル                | `docs/specifications/apex/triggers/<trigger>/index.md`     |
| Apex Batch     | `Database.Batchable` 実装クラス | `docs/specifications/apex/batches/<batch>/index.md`        |
| Apex Scheduler | `Schedulable` 実装クラス        | `docs/specifications/apex/schedulers/<scheduler>/index.md` |

- Apex Trigger は一オブジェクト一Triggerを原則とし、Triggerファイルごとに主仕様書を作成する。
- LWC Bundleは、独立した機能として主仕様書を作成するか、内部共通モジュールとして利用する主仕様書の対象メタデータに記載する。どちらにも分類されないBundleを残さない。
- LWC、Aura、Visualforceでは、画面を支えるApex Controller、Service、Selectorなども画面側の主仕様書に含める。
- BatchとSchedulerは専用の組み合わせでも別々の主仕様書を作成し、相互にリンクする。
- 未実装の種別では空ディレクトリを作らず、`docs/specifications/index.md` に対象がないことを記載する。

## 主仕様書と詳細仕様

主仕様書には入口メタデータの全体像、処理一覧、実行順序、関連する詳細仕様へのリンクを記載します。詳細仕様には、利用者から見て独立したユースケースの具体的な振る舞いを記載します。

- Triggerでは、Triggerから実行するユースケースごとに、処理が1つの段階から詳細仕様を作成する。
- LWC、Aura、Visualforceでは、検索、登録、承認など、入力、権限、エラー、テスト観点が独立する処理を詳細仕様にする。
- Flow、Batch、Schedulerでは、主仕様書だけで追跡しにくい独立処理がある場合に詳細仕様を作成する。
- クラス、Controller、Service、Selectorなどの技術レイヤーだけを理由に詳細仕様を分割しない。
- 主仕様書には詳細な判定条件や個別テストを重複させず、処理一覧から詳細仕様へ案内する。
- 詳細仕様には入口メタデータ全体の説明を重複させず、対象ユースケースの条件と振る舞いだけを記載する。

例えば、取引先トリガーは次の構成にします。

```text
docs/specifications/apex/triggers/account-trigger/
├── index.md
├── account-name-normalization.md
├── account-owner-assignment.md
└── account-status-management.md
```

## ファイル名

- 入口メタデータのディレクトリ名は、API名またはクラス名を内容の分かるkebab-caseにする。
- 詳細仕様のファイル名は、クラス名ではなくユースケースを表すkebab-caseにする。
- 主仕様書のファイル名は必ず `index.md` にする。
- 日付、連番、作業者名をファイル名に含めない。

## 主仕様書の構成

主仕様書は次の見出しをこの順序で使用します。

```markdown
# 機能名

## 概要

## 目的・利用場面

## 対象メタデータ

## 入力

## 処理内容

## 出力・更新対象

## 権限・実行条件

## エラー処理

## 関連コンポーネント

## テスト・確認観点

## 制約・注意事項
```

## 詳細仕様の構成

詳細仕様は次の見出しを必ずこの順序で使用します。該当する内容がない場合も見出しを残し、対象外であることと理由を記載します。

```markdown
# ユースケース名

## 概要

## 入力

## 処理内容

## 出力・更新対象

## 権限・実行条件

## エラー処理

## テスト・確認観点

## 制約・注意事項
```

## 更新時の確認

- 新しい入口メタデータには、対応するディレクトリと主仕様書を追加する。
- 新しいユースケースには、定義済みの分割ルールに従って詳細仕様を追加し、主仕様書の処理一覧からリンクする。
- メタデータ、権限、エラー処理、テストを変更した場合は、対応する主仕様書または詳細仕様を更新する。
- 仕様書を追加、移動、削除した場合は、`docs/specifications/index.md` と関連リンクを更新する。
- `npm run docs:check` で、リンク、見出し、索引、実装メタデータとの対応を確認する。
- `npm run prettier:verify` で整形を確認する。
