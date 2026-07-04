# ドキュメント配置ルール

AI エージェントが docs を配置・参照するときは、このルールに従います。

## 基本方針

- AI エージェントが作業中に参照する必要があるルール、手順、確認観点は、実行時に見つけやすい場所へ置く。
- README は入口にとどめ、詳細なルール、手順、判断基準は `docs/` 配下に置く。
- 同じ内容を複数箇所に長く重複させない。重複が必要な場合は要点だけを書き、詳細ページへリンクする。
- 本文、見出し、ファイル名には時系列の記録を固定しない。現在使う判断基準、確認観点、再確認条件を残す。
- 個人情報、秘密情報、org 固有値、会話上の一時的な表現は置かず、必要な判断材料だけに要約する。

## 配置判断

docs を追加、移動、分割するときは、上から順に判定します。
先に一致した場所へ置きます。

1. 作業前に一度だけ行う準備なら `docs/setup/` に置く。
2. 作業中に毎回守る開発ルール、確認観点、チェックリストなら `docs/development/` に置く。
3. Salesforce 組織に対する deploy / validate / retrieve / destructive changes / data import / Scratch Org 再現の手順なら `docs/deployment/` に置く。
4. まだ決定していない比較、検討、判断材料なら `docs/discussions/` に置く。
5. 実行ルールではない概念説明、背景、参考情報なら `docs/knowledge/` に置く。
6. README には、プロジェクト概要、主要な入口、セットアップの最短導線だけを書く。

## 迷ったときの移動先

### README.md

- 詳細な運用ルールや長いチェックリストは `docs/development/` へ移す。
- 一時的な判断過程は `docs/discussions/` へ移す。
- 個別 docs の一覧は `docs/index.md` に集約する。

### docs/setup/

- 日常開発で守る実装ルールは `docs/development/` へ移す。
- Salesforce 組織操作の実行ルールは `docs/deployment/` へ移す。
- 一般概念だけの説明は `docs/knowledge/` へ移す。

### docs/development/

- Salesforce 組織操作の詳細手順は `docs/deployment/` へ移す。
- 初回セットアップは `docs/setup/` へ移す。
- 決定前の設計案は `docs/discussions/` へ移す。
- 一般概念だけの説明は `docs/knowledge/` へ移す。

### docs/deployment/

- Apex や metadata の通常開発ルールは `docs/development/` へ移す。
- npm やローカル開発環境の準備手順は `docs/setup/` へ移す。
- 組織操作を伴わない一般概念説明は `docs/knowledge/` へ移す。

### docs/discussions/

- エージェントとの会話ログそのものは置かない。
- 実務で必ず守るルール、決定済みの手順、チェックリストは `docs/development/` へ移す。
- 一般概念だけの説明は `docs/knowledge/` へ移す。

決定済みの実務ルールになった内容は `docs/development/` に移すか、要点だけをリンクする。
ファイル名は日付ではなく、内容を表す slug にする。

### docs/knowledge/

- repo 固有の運用判断や実行すべきチェックリストは `docs/development/` へ移す。
- 特定 Salesforce 組織の操作手順や設定値は `docs/deployment/` へ移す。
- 今回の Issue だけの作業方針は、必要な場合だけ `docs/discussions/` へ移す。

AI エージェントに守らせる実務ルールは `docs/development/`、セットアップ手順は `docs/setup/`、Salesforce 組織操作ルールは `docs/deployment/` へ置く。

## 参照ルール

作業前に、変更対象に対応する docs を確認する。

1. セットアップや依存準備を変更する場合は `docs/setup/` を確認する。
2. Apex、metadata、GitHub、docs などの開発ルールに関わる場合は `docs/development/` を確認する。
3. Salesforce 組織操作を行う場合は `docs/deployment/` を確認する。
4. 背景や概念を確認する場合だけ `docs/knowledge/` を参照する。
5. 判断過程や未決定事項を確認する場合だけ `docs/discussions/` を参照する。

## 入口更新

新しい docs を追加、移動、削除した場合は、`docs/index.md` から辿れる状態にする。
