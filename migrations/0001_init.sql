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
