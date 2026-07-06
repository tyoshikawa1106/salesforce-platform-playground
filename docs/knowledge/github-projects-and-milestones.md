# GitHub Projects と Milestones

GitHub Projects と Milestones は、Issue や PR を違う観点で整理するための機能です。

## Projects

Project は、Issue や PR の状態を管理するための場所です。

主な用途:

- `Todo`、`In Progress`、`Done` で進行状況を見る。
- Issue と PR を同じボードで管理する。
- 担当者、ラベル、リポジトリ、更新状況などの列で並べ替える。
- 複数リポジトリの作業をまとめて見る。

Project は、継続的な作業管理に向いています。期限が決まっていない保守作業や、長く続くプロジェクトでも使いやすいです。

## Milestones

Milestone は、Issue や PR を終わりのある区切りでまとめるための機能です。

主な用途:

- `v1.0`、`v1.1` などのリリース単位でまとめる。
- `Sprint 1`、`Release train` などの作業単位でまとめる。
- `Sprint 1` などの短い作業期間でまとめる。
- `Initial setup` など、初期整備フェーズをまとめる。

Milestone には open / closed の進捗率が表示されます。期限やリリース対象がある作業に向いています。

## 使い分け

| 観点     | Project                      | Milestone                  |
| -------- | ---------------------------- | -------------------------- |
| 目的     | 状態管理                     | 区切り管理                 |
| 例       | `Todo`、`In Progress`        | `v1.0`、`Initial setup`    |
| 期間     | 継続利用しやすい             | 終わりがある作業に向く     |
| 対象     | Issue / PR / draft item      | Issue / PR                 |
| 見たい値 | 何が進行中か、誰が持つか     | どこまで完了したか         |
| 注意点   | 入れすぎるとボードが散らかる | 期限がない作業には向かない |

## Labels との違い

Label は、Issue や PR の種類を表します。

例:

- `bug`
- `documentation`
- `enhancement`
- `area:github`

同じ Issue に対して、Project、Milestone、Label は同時に使えます。

例:

- Project: `Platform Playground`
- Milestone: `v1.0`
- Label: `documentation`, `area:github`

この場合、Project は「今どの状態か」、Milestone は「どの区切りで終えるか」、Label は「何の作業か」を表します。

## 継続運用での考え方

長く続くプロジェクトでは、Project を常設し、Milestone は必要なときだけ使う方が扱いやすいです。

- Project は全件の状態管理に使う。
- Label は分類に使う。
- Milestone は期限、リリース、スプリントなどがある作業だけに使う。

未分類の作業をすべて `Backlog` のような Milestone に入れ続けると、Milestone の進捗率や期限の意味が薄くなります。

期限やリリースがない場合は、Milestone を付けずに Project と Label で管理する方が自然です。
