# 邀请码注册

抽象大乱斗的本地入口。进程只听 `127.0.0.1:43180`，前面用 nginx 把 `/brawl/` 反代进来。没有 basic auth，也不是在线对战。

邀请码、数据库、服务器密码都不要写进仓库。

## 做什么

- `GET /brawl/` 公开入口（本目录的 `index.html`）：本地 2–4 人，版本卡片指向 `/brawl/v0.1.1/`。已安装的 `/brawl/v0.1.0/` 留作静态存档，不从入口卡片进入。
- `GET /brawl/register`、`GET /brawl/login` 公开。
- `POST /brawl/api/register` 字段 `invite`、`username`（2–24）、`password`（至少 8 位，最长 128）。成功时 `303` 到 `/brawl/`，并种下会话 cookie。
- `POST /brawl/api/login` 成功后 `303`。`next` 只接受本站 `/brawl` 路径，其它地址回到 `/brawl/`。
- `POST /brawl/api/logout` 清会话，`303` 回入口。
- `GET /brawl/vX.Y.Z/` 和它的 `index.html` 要有会话，否则 `303` 到 `/brawl/login?next=...`。
- 版本目录里的 `.js` `.css` `.svg` `.woff` `.woff2` 直接给。当前字体 CSS 会要 `.woff`，所以比 `.woff2` 多放了这一种。游戏入口是 index，不是 basic auth。

Cookie：

```text
brawl_session=...; HttpOnly; Secure; SameSite=Lax; Path=/brawl; Max-Age=604800
```

`Secure` 只在 HTTPS 下会被浏览器保存。用 http://127.0.0.1 打开时，注册看起来跳转了，下一次请求却没有登录态。正式站点走 TLS。

密码是 PBKDF2-HMAC-SHA256，200000 次，每用户随机盐。邀请码在 `BEGIN IMMEDIATE` 里核销，用过一次就不能再注册。用户名大小写不敏感（SQLite `NOCASE`，ASCII）。

数据库默认 `/var/lib/brawl-auth/brawl.db`（`BRAWL_DB`）。静态文件默认 `/var/www/brawl`（`BRAWL_STATIC`）。当前版本页是 `/var/www/brawl/v0.1.1/index.html`。`/var/www/brawl/v0.1.0/` 若已存在，保持原样当存档，不要覆盖或删除。不要把对局文件放在 `/var/www/brawl/index.html`。

## 本地测试

```bash
cd tools/invite-auth
python3 -m unittest test_app.py
```

仓库根上再跑游戏本身：

```bash
npm test
npm run build
```

构建后 `dist/index.html` 里的脚本应是 `./assets/...`，不是 `/assets/...`。图标是 `./favicon.svg`。

可选的本机烟测（仍然只绑环回，浏览器登录需要 HTTPS 才会带上 Secure cookie）：

```bash
export BRAWL_DB=/tmp/brawl-auth-dev/brawl.db
export BRAWL_STATIC=/tmp/brawl-auth-dev/www
export BRAWL_PORT=43180
mkdir -p "$(dirname "$BRAWL_DB")" "$BRAWL_STATIC/v0.1.1"
cp -a ../../dist/. "$BRAWL_STATIC/v0.1.1/"
python3 manage.py new 20
python3 app.py
```

## 邀请码

在服务器上、服务目录里执行。码打到标准输出，交给玩家即可，不要提交。

```bash
cd /opt/brawl-auth
sudo python3 manage.py new 20
sudo python3 manage.py ls
```

字符表去掉了 `0` `O` `1` `I`。`new` 的数量是 1 到 500。

## 部署

仓库里没有主机账号。下面只写路径，由你自己 SSH 上去做。不要把 sudo 密码、邀请码或 `brawl.db` 拷回仓库。

1. 在构建机器上，停在要发布的提交：

   ```bash
   npm ci
   npm test
   npm run build
   grep -o 'src="[^"]*"' dist/index.html
   ```

   确认输出是 `src="./assets/..."`。

2. 在服务器上准备目录，并放上对局文件和程序。`dist/` 的内容进 `/var/www/brawl/v0.1.1/`，不是 `/var/www/brawl/` 根。不要覆盖或删除已经放好的 `/var/www/brawl/v0.1.0/`，那一份静态文件留作存档。

   ```bash
   sudo mkdir -p /opt/brawl-auth /var/lib/brawl-auth /var/www/brawl/v0.1.1
   sudo chmod 700 /var/lib/brawl-auth
   sudo cp -a dist/. /var/www/brawl/v0.1.1/
   sudo cp tools/invite-auth/app.py tools/invite-auth/manage.py tools/invite-auth/index.html /opt/brawl-auth/
   sudo cp tools/invite-auth/brawl-auth.service /etc/systemd/system/brawl-auth.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now brawl-auth
   sudo systemctl status brawl-auth --no-pager
   ```

   单元文件是 `WorkingDirectory=/opt/brawl-auth`，`ExecStart=/usr/bin/python3 /opt/brawl-auth/app.py`，`Environment=BRAWL_PORT=43180`，失败后重启。进程只听 `127.0.0.1`。

3. 生成邀请码（见上一节）。

4. 在现有的 TLS `server { }` 里只加下面两段。`proxy_pass` 不要加结尾斜杠，否则会把 `/brawl/` 从路径里剥掉。`Host $host` 保留访客原来的主机名。其它 location 不动。

   ```nginx
   location = /brawl {
       auth_basic off;
       return 301 /brawl/;
   }

   location /brawl/ {
       auth_basic off;
       proxy_pass http://127.0.0.1:43180;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

   如果整站原来有 basic auth，这两段里的 `auth_basic off;` 只关掉 `/brawl` 这一支。不要把密码文件写进仓库，也不要再为 `/brawl` 配一套 basic auth。

5. 检查并重载：

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

6. 用你自己的域名确认（把 `YOUR_HOST` 换成站点，不要把真实响应里的密钥贴回仓库）：

   ```bash
   curl -sI "https://YOUR_HOST/brawl/" | head
   curl -sI "https://YOUR_HOST/brawl/v0.1.1/" | head
   ```

   入口应是 200。v0.1.1 版本页在没有会话时应是 `303`，`Location` 指向 `/brawl/login?next=...`。注册一张码后再打开 v0.1.1 卡片，游戏脚本从 `./assets/` 加载。`/brawl/v0.1.0/` 仍可留在磁盘上当存档，入口不再指向它。
