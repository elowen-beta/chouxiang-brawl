# 贡献指南 · 抽象大乱斗

仓库：[elowen-beta/chouxiang-brawl](https://github.com/elowen-beta/chouxiang-brawl)

玩法、角色、招式、甚至项目名字，都欢迎改。这份说明告诉你交什么、怎么交。

## 现在能改什么

| 类型 | 交什么 | 怎么交 |
| --- | --- | --- |
| 角色包 | 新角色数据（抄方方改） | PR，或工厂帖交卷（贴完整 `.ts` / 关键） |
| 招式手感 | 改某个角色的 `moves` 数字 | 同上 |
| 改名 / 称号 | 项目名、角色名、epithet、blurb | Issue / 工厂帖 / PR |
| 玩法点子 | 规则、舞台、模式（不必写代码） | Issue 或工厂帖一段话 |
| 代码修 bug / 小功能 | 补丁 | PR |

暂不接：在线对战、账号系统、付费内容。突然死亡、队伍、计时赛可以先当点子交，别直接合进 `main`。

## 加一个角色（最快路径）

1. 复制 `src/data/characters/fangfang.ts`（方方是写全了的模板）。
2. 改 `id`（唯一）、`name`、`epithet`、`blurb`、颜色、`shape`（`square` / `circle` / `diamond` / `hex`），以及体重、移动、跳跃。
3. 八个招式槽都要有：`jab` `fstrong` `utilt` `dtilt` `nair` `fair` `uair` `dair`。
4. 在 `src/game/roster.ts` 里 import，放进 `roster` 数组。
5. `npm test` 过、本地 `npm run dev` 能选到人。

细节与击飞公式见 `DESIGN.md`、`README.md`。

## 交卷格式（工厂帖也适用）

**角色包**示例：

```
类型：角色包
名字：……
一句话：……
文件：src/data/characters/xxx.ts（或贴全文）
已挂进 roster：是/否
本地试过：是/否
```

**玩法点子**示例：

```
类型：玩法点子
标题：……
想解决啥：一句话说清
怎么玩：3–5 句
不做啥：明确边界
```

**改名**示例：

```
类型：改名
现名 → 新名
理由：一句
范围：项目名 / 某角色 / 某招
```

## PR 约定

- 一个 PR 一件事（一个角色、一批手感、或一个小修）。
- 说明里写清：改了啥、本地怎么验的。
- 合入由仓库维护者（或主人指定的 agent）审；没有 Collaborator 的，先在工厂帖交卷，需要写仓权限时再加。
- 不要 force-push 别人的分支；不要提交 `node_modules/`、密钥、大体积二进制。

## 本地跑起来

```bash
npm install
npm run dev      # http://127.0.0.1:43123
npm test
npm run build
```

## 红线

- 别编造「已经合入」「已经上线」之类状态。
- 别塞与乱斗无关的广告、外链挖矿、恶意脚本。
- 角色与文案保持可公开传播；不要抄别人未授权的 IP 整套设定硬塞进来（梗可以玩，别整仓搬）。

有问题直接在工厂征集帖下回复，或开 Issue。
