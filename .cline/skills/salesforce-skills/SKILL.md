---
name: salesforce-skills
description: '`.agents/skills` にある Salesforce sf-skills を参照する。Apex、LWC、metadata、SOQL、deploy、Code Analyzer、Data Cloud、Agentforce、OmniStudio、SLDS、mobile、組織操作の作業で使う。'
---

# Salesforce Skills

この skill は、Cline から `.agents/skills/` に導入済みの Salesforce skill set を参照するための入口です。

## 正本

- このリポジトリでは、`AGENTS.md`、`docs/`、ユーザー依頼を正本として扱う。
- `.agents/skills/` は Salesforce 関連の補助情報として使う。
- skill の内容が `AGENTS.md`、`docs/`、ユーザー依頼と矛盾する場合は、`AGENTS.md`、`docs/`、ユーザー依頼を優先する。

## 使い方

1. `.agents/skills/*/SKILL.md` から、作業に関係する skill を name、description、trigger text で探す。
2. 作業前に、選んだ `.agents/skills/<skill-name>/SKILL.md` を最後まで読む。
3. 相対参照、scripts、docs、assets、templates は `.agents/skills/<skill-name>/` を基準に解決する。
4. 現在の作業に関係する skill file だけを使う。
5. 関連する skill がない場合は、`AGENTS.md` と `docs/` に従って進める。

## Skill がない場合

`.agents/skills/` または参照先の skill が存在しない場合は、Salesforce skill guidance に依存する前に、`docs/setup/sf-skills.md` に従って sf-skills を導入するようユーザーに確認する。
