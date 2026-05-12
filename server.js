/**
 * server.js — 减肥助手后端
 * 作为 GitHub Gist 代理，GitHub Token 只存在服务器，用户无感知
 *
 * 安装：npm install express better-sqlite3 cors node-fetch
 * 启动：GITHUB_TOKEN=ghp_xxx node server.js
 *
 * 环境变量：
 *   PORT=3000
 *   GITHUB_TOKEN=ghp_xxx        (必填，你自己的 GitHub Token，需要 gist 权限)
 *   ACCESS_TOKEN=xxx            (可选，限制谁能访问这个服务器)
 */

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const GIST_API = 'https://api.github.com/gists';
const GIST_FILENAME = 'jianfei-data.json';

if (!GITHUB_TOKEN) {
    console.warn('⚠️  警告：未设置 GITHUB_TOKEN，云同步功能将无法使用');
}

// ── SQLite：只存 userId → gistId 的映射，体积极小 ──────────
const db = new Database(path.join(__dirname, 'mapping.db'));
db.exec(`
    CREATE TABLE IF NOT EXISTS user_gists (
        user_id TEXT PRIMARY KEY,
        gist_id TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
`);

// ── App ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

// 可选：服务器访问鉴权
function auth(req, res, next) {
    if (!ACCESS_TOKEN) return next();
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (token !== ACCESS_TOKEN) return res.status(401).json({ error: '无效的访问令牌' });
    next();
}

// GitHub API 请求封装
const fetch = require('node-fetch');
async function githubFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            ...(options.headers || {}),
        },
    });
}

// ── 上传备份 ──────────────────────────────────────────────
app.post('/api/backup', auth, async (req, res) => {
    const { userId, data } = req.body;
    if (!userId) return res.status(400).json({ error: '缺少用户标识' });
    if (!GITHUB_TOKEN) return res.status(503).json({ error: '服务器未配置 GitHub Token' });

    const content = JSON.stringify({ ...data, _backupAt: new Date().toISOString() }, null, 2);
    const row = db.prepare('SELECT gist_id FROM user_gists WHERE user_id = ?').get(userId);

    try {
        let gistId = row?.gist_id;
        let resp;

        if (gistId) {
            resp = await githubFetch(`${GIST_API}/${gistId}`, {
                method: 'PATCH',
                body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } }),
            });
        } else {
            resp = await githubFetch(GIST_API, {
                method: 'POST',
                body: JSON.stringify({
                    description: `减肥助手备份 #${userId.slice(0, 8)}`,
                    public: false,
                    files: { [GIST_FILENAME]: { content } },
                }),
            });

            if (resp.ok) {
                const gist = await resp.json();
                gistId = gist.id;
                db.prepare('INSERT INTO user_gists (user_id, gist_id, created_at) VALUES (?, ?, ?)')
                    .run(userId, gistId, new Date().toISOString());
                return res.json({ ok: true, gistId });
            }
        }

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `GitHub 返回 ${resp.status}`);
        }

        res.json({ ok: true, gistId });
    } catch (e) {
        console.error('备份失败:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── 恢复备份 ──────────────────────────────────────────────
app.get('/api/restore/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    if (!GITHUB_TOKEN) return res.status(503).json({ error: '服务器未配置 GitHub Token' });

    const row = db.prepare('SELECT gist_id FROM user_gists WHERE user_id = ?').get(userId);
    if (!row) return res.status(404).json({ error: '没有找到你的备份，请先上传一次' });

    try {
        const resp = await githubFetch(`${GIST_API}/${row.gist_id}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `GitHub 返回 ${resp.status}`);
        }

        const gist = await resp.json();
        const fileContent = gist.files[GIST_FILENAME]?.content;
        if (!fileContent) throw new Error('备份文件不存在');

        res.json(JSON.parse(fileContent));
    } catch (e) {
        console.error('恢复失败:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ ok: true, githubReady: !!GITHUB_TOKEN });
});

app.listen(PORT, () => {
    console.log(`减肥助手服务器 → http://localhost:${PORT}`);
    console.log(`GitHub 同步：${GITHUB_TOKEN ? '✅ 已配置' : '❌ 未配置 GITHUB_TOKEN'}`);
});
