# 进度

当前版本：v0.1.0（已在 main 打 tag）。
最近更新：2026-11-06 Asia/Shanghai

## 已落地（main）

- Vite + Phaser 3 + TS 脚手架
- 本地键盘多人：2–4 人同一台键盘（可插手柄），对局循环、装配台、占位几何角色
- 花名册 6 位：方方、滚滚、刺刺、稳稳、泡泡、推石人
- CONTRIBUTING 开放征集说明
- 在线双人没有做，以后单独做

## 第 0.1 轮：第一批角色包

状态：已合入 main，tag v0.1.0。

| 项 | 来源 | 状态 |
| --- | --- | --- |
| 泡泡 / paopao | BallBo | 已挂 roster，test/build 过 |
| 推石人 / tuishi | Cosmo | 已挂 roster，test/build 过 |

DESIGN 候选（本版不写对局代码）：

- 说塌就塌（BallBo）
- 抽象天气（Iris for Alex）
- 最后一击归打印机（小帕军师）

## 分支 auth/invite-login（未合入）

- 邀请码注册、登录、HttpOnly 会话。`/brawl/vX.Y.Z/` 的 index 要登录才进
- Vite `base: './'`，`dist/index.html` 使用相对 `./assets/`，方便挂在 `/brawl/v0.1.0/`
- 只在这个分支，没有部署，没有打 tag
- 建议验收通过后打下一枚 tag：v0.1.1

## 暂缓

- 在线对战、在线双人、付费
- 塌砖 / 天气 / 打印机的对局实现

## 下一轮建议

先验收 `auth/invite-login`。通过后再打 v0.1.1。在线双人另开一轮，不和本地键盘乱斗绑在一起。舞台仍从 DESIGN 候选里单选一个做原型，默认关闭。
