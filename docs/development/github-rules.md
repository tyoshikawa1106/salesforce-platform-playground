# GitHub 運用ルール

GitHub Flowで変更を管理するときの共通ルールです。Issue、Project、Milestone、ラベル、Release、CIなどの利用有無はリポジトリごとに異なるため、この文書では前提にしません。

対象リポジトリに固有ルールがある場合は、共通ルールを基本とし、固有ルールを追加適用します。

## 基本ルール

- GitHub作業の実行可否とユーザー確認の境界は、対象リポジトリの`AGENTS.md`に従う。
- 変更前に現在のbranch、作業ツリー、remote、既存PRを確認する。
- default branchへ直接コミットせず、作業branchからPull Requestを作成する。
- branch名には作業内容が分かる短いsummaryを入れる。
- hookが依存不足で失敗した場合、勝手に依存を導入せず確認する。
- Issue、PR template、label、assignee、Project、Milestone、Release、CI、branch protectionは、対象リポジトリの固有ルールと現在のGitHub設定を確認する。

## GitHub Flowの実行順序

1. 現在のrepository stateと作業対象を確認する。
2. default branchから作業branchを作成する。
3. 変更、ローカル検証、コミットを行う。
4. ローカルコミット後に一度停止する。
5. ユーザーの明示依頼がある場合だけ、push、PR作成、CI確認へ進む。
6. 必須チェックと未解決のreview conversationを確認する。
7. ユーザーの明示依頼がある場合だけPRをmergeする。
8. merge後にdefault branchを同期し、条件を満たす場合は作業branchを整理する。

対象リポジトリでIssueや外部サービスとの連携が必要な場合は、固有ルールに定義された確認をこの順序へ追加します。

## PR作成とmerge

- PR本文は変更内容、変更理由、影響範囲、確認結果をレビューできる内容にする。
- 対象リポジトリにPR templateがある場合は、その構成に従う。
- 必須CI、review、外部検証など、対象リポジトリのmerge条件を満たしてからmergeする。
- merge方法は対象リポジトリの設定または固有ルールに従う。

## PR merge後の作業branch整理

PR merge後は、次の条件をすべて満たす場合に限り、エージェントが明示確認なしで作業branch整理を実行してよいです。

- PRがmerge済みであることを確認できる。
- 作業ツリーがcleanで、未コミット変更がない。
- 現在の作業branchがmerge済みPRのbranchであることを確認できる。
- default branchへ戻り、`git pull --ff-only`で同期できる。
- 作業branchを`git branch -d <branch>`で削除できる。
- 対応するremote作業branchが残っている場合は、`git push origin --delete <branch>`で削除できる。

次の場合は自動実行せず、ユーザーに確認します。

- 未コミット変更がある。
- PRのmerge状態や削除対象branchを確認できない。
- `git pull --ff-only`が失敗する。
- branch削除に`git branch -D`が必要になる。
- remote branchが保護対象、共有作業中、または削除可否を確認できない。
- push、PR作成、CI確認、mergeなど、作業branch整理の範囲を超える操作が必要になる。

## コミット本文

実質的な変更を含むコミットは、subjectだけで終わらせず本文を付けます。本文には、後から変更理由と確認結果を判断できる情報だけを簡潔に残します。

- subjectから分からない背景、問題、判断理由を記載する。
- 複数の重要な変更や判断境界がある場合は、主な変更内容を記載する。
- 最後の段落を`検証:`で始め、実行した確認コマンドと結果を記載する。必要な検証を実行していない場合は理由も記載する。
- subjectを言い換えただけの本文や、変更ファイルの機械的な列挙だけで終わらせない。
- 改行は実際の改行として入力し、本文に`\n`などのエスケープ表現を残さない。
- 実ユーザー名、メールアドレス、環境固有のユーザー名やID、秘密情報を記載しない。

次のように判断を伴わない機械的・軽微なコミットでは、本文を省略してよいです。

- typo修正のみ。
- フォーマットのみ。
- 同じ生成手順による生成物更新のみ。
