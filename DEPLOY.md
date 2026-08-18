# SFS 汉化模组下载中心 - 部署指南

本文档指导你手动部署 Waline 评论系统到 Cloudflare Workers + D1，并上线主站的 5 个新功能（独立模组页 / 评论 / 评分 / 下载记录 / 收藏统计）。

## 前置条件

- 已注册 [Cloudflare](https://dash.cloudflare.com) 账号
- 本地已安装 Node.js 18+（推荐 20+）
- 主站已部署在 Cloudflare Pages（项目名 `sfszhmod`）

## 第 1 步：登录 Cloudflare

在项目根目录打开终端：

```bash
npx wrangler login
```

浏览器会自动打开授权页面，点击"允许"即可。验证登录：

```bash
npx wrangler whoami
```

## 第 2 步：创建 D1 数据库

```bash
npx wrangler d1 create sfs-db
```

输出类似：

```
✅ Successfully created DB 'sfs-db' in region APAC
Created your database using D1's new storage backend.
[[d1_databases]]
binding = "DB"
database_name = "sfs-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**记下 `database_id`**，后面要填到两个配置文件里。

## 第 3 步：填入数据库 ID

把上一步得到的 `database_id` 填入以下两个文件的 `database_id` 字段：

1. 主站 `/workspace/wrangler.toml`（绑定名 `SFS_DB`）
2. Waline Worker `/workspace/waline-worker/wrangler.toml`（绑定名 `DB`）

## 第 4 步：初始化数据库表结构

在 `waline-worker` 目录下执行（该 schema 同时创建 Waline 评论表 + 评分表 + 下载记录表）：

```bash
cd /workspace/waline-worker
npx wrangler d1 execute sfs-db --remote --file=./schema.sql
```

看到 `Executed 10 statements` 之类的输出即成功。

## 第 5 步：设置 JWT 密钥

评论登录加密需要密钥，用任意随机字符串即可：

```bash
npx wrangler secret put JWT_SECRET
```

按提示粘贴一个随机字符串（例如用 `openssl rand -hex 32` 生成）。

## 第 6 步：部署 Waline Worker

在 `waline-worker` 目录下：

```bash
npx wrangler deploy
```

部署成功后输出类似：

```
Uploaded waline-on-worker (3.24 sec)
Deployed waline-on-worker (0.31 sec)
  https://waline-on-worker.你的子域.workers.dev
```

**记下这个 workers.dev 地址**。

## 第 7 步：配置主站代理（重要）

`workers.dev` 域名在中国大陆无法直接访问，所以主站通过 Pages Function 代理评论请求，浏览器只访问主站域名。

代理文件已内置在 `functions/waline-proxy/[[path]].js`，只需把其中的 Waline Worker 地址改成你的实际地址：

```js
// functions/waline-proxy/[[path]].js
const WALINE_WORKER = 'https://waline-on-worker.你的子域.workers.dev';
```

前端三处 `WALINE_SERVER` 已配置为走代理（无需再改）：

1. `/workspace/app.js`：`const WALINE_SERVER = location.origin + '/waline-proxy';`
2. `/workspace/app.min.js`：同上（压缩版，需与 app.js 同步）
3. `/workspace/functions/mod/[slug].js`：`const WALINE_SERVER = '/waline-proxy';`

> 注意：如果你不用代理、直接填 workers.dev 地址，大陆用户将无法加载评论。建议保持代理方案。

## 第 8 步：重新部署主站

主站是 Cloudflare Pages 项目。两种方式任选：

### 方式 A：Git 集成（推荐）

```bash
git add -A
git commit -m "feat: 独立模组页 + 评论/评分/下载记录/收藏统计"
git push
```

Pages 会自动构建部署。

### 方式 B：Wrangler 直传

```bash
cd /workspace
npx wrangler pages deploy . --project-name sfszhmod
```

## 第 9 步：验证

部署完成后访问以下地址确认：

| 功能 | 验证方式 |
|------|---------|
| 独立模组页 | 打开任意 `/mod/模组slug`，确认页面正常、SEO meta 存在 |
| 评论 | 在模组页底部发表评论，确认能提交并显示 |
| 评分 | 点击星星评分，确认平均分和人数更新 |
| 下载记录 | 点击下载，打开"下载记录"查看个人记录 |
| 收藏统计 | 收藏一个模组，确认计数 +1 |

## 常见问题

### 评论进不去 / 评论区空白

原因：Waline 客户端（CSS/JS）之前从 `cdn.jsdelivr.net` 加载，该域名在中国大陆经常被墙。

已修复：Waline 客户端已**本地化**到 `waline/waline.js` 和 `waline/waline.css`，随主站一起部署，不再依赖外部 CDN。重新部署主站后即可正常加载。

### 下载统计 / 收藏统计不显示

原因：统计加载时机在页面加载后固定 500ms 执行，若数据加载较慢导致卡片未渲染，计数就永远不显示。

已修复：统计加载已移到卡片渲染完成后执行（`renderFiles` 内调用），并加了防重复请求。重新部署主站后即可正常显示。

### 评论提交后不显示

- 检查 Waline Worker 是否已部署，直接访问 `https://waline-on-worker.xxx.workers.dev` 看是否有响应
- 检查主站 `WALINE_SERVER` 是否已更新并重新部署
- 检查 D1 表是否已初始化（第 4 步）

### 评分/下载记录报错

- 确认主站 `wrangler.toml` 的 `database_id` 已填写
- 确认主站已重新部署（Pages 需要重新构建）

### CORS 报错

默认允许所有来源。如需限制，在 `waline-worker/wrangler.toml` 的 `[vars]` 中取消注释并填写：

```toml
[vars]
SECURE_DOMAINS = "sfszhmod.pages.dev"
```

然后重新部署 Waline Worker。
