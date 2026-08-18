# SFS 汉化模组下载中心 - 部署指南

本文档指导你部署主站到 Cloudflare Pages，并初始化 D1 数据库以启用评分 / 下载记录 / 收藏统计功能（评论区已移除）。

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

**记下 `database_id`**，后面要填到主站配置文件里。

## 第 3 步：填入数据库 ID

把上一步得到的 `database_id` 填入 `/workspace/wrangler.toml` 的 `database_id` 字段（绑定名 `SFS_DB`）。

## 第 4 步：初始化数据库表结构

在项目根目录执行（该 schema 创建评分表 + 下载记录表）：

```bash
npx wrangler d1 execute sfs-db --remote --file=./migrations/0001_init.sql
```

看到 `Executed 2 statements` 之类的输出即成功。

## 第 5 步：重新部署主站

主站是 Cloudflare Pages 项目。两种方式任选：

### 方式 A：Git 集成（推荐）

```bash
git add -A
git commit -m "feat: 移除评论区，新增热力值/更新日期排序，黑白简约详情页"
git push
```

Pages 会自动构建部署。

### 方式 B：Wrangler 直传

```bash
cd /workspace
npx wrangler pages deploy . --project-name sfszhmod
```

## 第 6 步：验证

部署完成后访问以下地址确认：

| 功能 | 验证方式 |
|------|---------|
| 独立模组页 | 打开任意 `/mod/模组slug`，确认黑白简约页面正常、SEO meta 存在 |
| 评分 | 点击星星评分，确认平均分和人数更新 |
| 下载记录 | 点击下载，打开"下载记录"查看个人记录 |
| 收藏统计 | 收藏一个模组，确认计数 +1 |
| 排序 | 首页下拉选择"热力值"或"更新日期"，确认卡片顺序变化 |

## 常见问题

### 下载统计 / 收藏统计不显示

原因：统计加载时机在页面加载后固定 500ms 执行，若数据加载较慢导致卡片未渲染，计数就永远不显示。

已修复：统计加载已移到卡片渲染完成后执行（`renderFiles` 内调用），并加了防重复请求。重新部署主站后即可正常显示。

### 评分/下载记录报错

- 确认主站 `wrangler.toml` 的 `database_id` 已填写
- 确认 D1 表已初始化（第 4 步）
- 确认主站已重新部署（Pages 需要重新构建）

### 热力值排序不生效

- 确认 `data/data.json` 中对应模组已填写 `heat` 字段（支持 `12.5万`、`125000` 等格式）
- 确认首页下拉已选择"热力值"
