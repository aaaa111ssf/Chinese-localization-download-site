# Waline 评论系统部署脚本（Windows PowerShell）
# 用法: 在 waline-worker 目录下运行  .\deploy.ps1
# 前提: 已安装 Node.js 和 wrangler，并已登录 Cloudflare (npx wrangler login)

$ErrorActionPreference = "Stop"

Write-Host "=== 1/4 创建 D1 数据库（如果还没有） ===" -ForegroundColor Cyan
$dbCheck = npx wrangler d1 list 2>$null
if ($dbCheck -match "sfs-db") {
    Write-Host "数据库 sfs-db 已存在" -ForegroundColor Green
} else {
    npx wrangler d1 create sfs-db
    Write-Host ""
    Write-Host "!!! 重要：请把上面输出的 database_id 填入以下两个文件的 database_id 字段：" -ForegroundColor Yellow
    Write-Host "  1. 主站 wrangler.toml（站点根目录）" -ForegroundColor Yellow
    Write-Host "  2. waline-worker/wrangler.toml（本目录）" -ForegroundColor Yellow
    Read-Host "填好后按回车继续"
}

Write-Host "=== 2/4 初始化数据库表结构 ===" -ForegroundColor Cyan
npx wrangler d1 execute sfs-db --remote --file=./schema.sql

Write-Host "=== 3/4 设置 JWT 密钥 ===" -ForegroundColor Cyan
Write-Host "请输入一个随机字符串作为 JWT_SECRET（评论登录加密用）：" -ForegroundColor Yellow
$secret = Read-Host "JWT_SECRET"
if ([string]::IsNullOrWhiteSpace($secret)) { $secret = -join ((48..122) | Get-Random -Count 32 | % {[char]$_}) }
$secret | npx wrangler secret put JWT_SECRET

Write-Host "=== 4/4 部署 Worker ===" -ForegroundColor Cyan
npx wrangler deploy

Write-Host ""
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "请把部署输出的 workers.dev 地址（形如 https://waline-on-worker.xxx.workers.dev）" -ForegroundColor Yellow
Write-Host "填入主站 app.js 和 functions/mod/[slug].js 中的 WALINE_SERVER 常量，然后重新部署主站。" -ForegroundColor Yellow
