-- Waline on Worker D1 Schema
-- Compatible with Waline SQLite schema

CREATE TABLE IF NOT EXISTS "wl_Comment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "comment" TEXT,
  "orig" TEXT,
  "insertedAt" TEXT DEFAULT (datetime('now')),
  "ip" TEXT,
  "link" TEXT,
  "mail" TEXT,
  "nick" TEXT,
  "pid" INTEGER,
  "rid" INTEGER,
  "sticky" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'approved',
  "like" INTEGER DEFAULT 0,
  "ua" TEXT,
  "url" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_comment_url" ON "wl_Comment" ("url");
CREATE INDEX IF NOT EXISTS "idx_comment_status" ON "wl_Comment" ("status");
CREATE INDEX IF NOT EXISTS "idx_comment_rid" ON "wl_Comment" ("rid");
CREATE INDEX IF NOT EXISTS "idx_comment_pid" ON "wl_Comment" ("pid");
CREATE INDEX IF NOT EXISTS "idx_comment_user_id" ON "wl_Comment" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_comment_insertedAt" ON "wl_Comment" ("insertedAt");

CREATE TABLE IF NOT EXISTS "wl_Counter" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "time" INTEGER DEFAULT 0,
  "reaction0" INTEGER DEFAULT 0,
  "reaction1" INTEGER DEFAULT 0,
  "reaction2" INTEGER DEFAULT 0,
  "reaction3" INTEGER DEFAULT 0,
  "reaction4" INTEGER DEFAULT 0,
  "reaction5" INTEGER DEFAULT 0,
  "reaction6" INTEGER DEFAULT 0,
  "reaction7" INTEGER DEFAULT 0,
  "reaction8" INTEGER DEFAULT 0,
  "url" TEXT NOT NULL,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_counter_url" ON "wl_Counter" ("url");

CREATE TABLE IF NOT EXISTS "wl_Users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "display_name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "password" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'guest',
  "label" TEXT DEFAULT '',
  "url" TEXT DEFAULT '',
  "avatar" TEXT DEFAULT '',
  "github" TEXT DEFAULT '',
  "twitter" TEXT DEFAULT '',
  "facebook" TEXT DEFAULT '',
  "google" TEXT DEFAULT '',
  "weibo" TEXT DEFAULT '',
  "qq" TEXT DEFAULT '',
  "2fa" TEXT DEFAULT '',
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "wl_Users" ("email");

CREATE TABLE IF NOT EXISTS "wl_Settings" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL DEFAULT '',
  "updatedAt" TEXT DEFAULT (datetime('now'))
);
-- SFS 站点功能 D1 Schema
-- 评分表：每个用户(按 cookie+IP 识别)对每个模组只能评一次
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mod_name TEXT NOT NULL,
  user_key TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_user ON ratings(mod_name, user_key);
CREATE INDEX IF NOT EXISTS idx_ratings_mod ON ratings(mod_name);

-- 下载记录表：服务端下载日志（用于最近下载榜）
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mod_name TEXT NOT NULL,
  ip_hash TEXT,
  ua TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_downloads_mod ON downloads(mod_name);
CREATE INDEX IF NOT EXISTS idx_downloads_time ON downloads(created_at);
