/**
 * server.js — 云同步后端
 * Node.js + Express + SQLite (via better-sqlite3)
 *
 * 安装依赖：npm install express better-sqlite3 cors
 * 启动：    node server.js
 * 默认端口：3000
 *
 * 环境变量：
 *   PORT=3000
 *   ACCESS_TOKEN=your-secret-token   (不设则不校验)
 *   DB_PATH=./data.db                (SQLite文件路径)
 */

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

// ── DB setup ──────────────────────────────────────────────
const db = new Database(DB_PATH);
db.exec(`
    CREATE TABLE IF NOT EXISTS user_data (
        token TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
`);

// ── App ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Auth middleware
function auth(req, res, next) {
    if (!ACCESS_TOKEN) return next();
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '').trim();
    if (token !== ACCESS_TOKEN) {
        return res.status(401).json({ error: '无效的访问令牌' });
    }
    next();
}

// Key per token (supports future multi-user by using different tokens)
function userKey(req) {
    const header = req.headers.authorization || '';
    return header.replace('Bearer ', '').trim() || 'default';
}

// ── Routes ────────────────────────────────────────────────

// Upload data
app.post('/api/sync', auth, (req, res) => {
    const key = userKey(req);
    const payload = JSON.stringify(req.body);
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO user_data (token, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(key, payload, now);

    res.json({ ok: true, updatedAt: now });
});

// Download data
app.get('/api/sync', auth, (req, res) => {
    const key = userKey(req);
    const row = db.prepare('SELECT payload, updated_at FROM user_data WHERE token = ?').get(key);

    if (!row) {
        return res.status(404).json({ error: '暂无云端数据' });
    }

    try {
        const data = JSON.parse(row.payload);
        data._syncedAt = row.updated_at;
        res.json(data);
    } catch {
        res.status(500).json({ error: '数据解析失败' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`减肥助手服务器已启动 → http://localhost:${PORT}`);
    if (ACCESS_TOKEN) {
        console.log(`访问令牌已设置（${ACCESS_TOKEN.slice(0, 4)}...）`);
    } else {
        console.log('警告：未设置 ACCESS_TOKEN，任何人都可以访问数据');
    }
});
