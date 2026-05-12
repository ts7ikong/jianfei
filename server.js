/**
 * server.js — 减肥助手后端
 * 作为 GitHub Gist 代理，GitHub Token 只存在服务器，用户无感知
 *
 * 安装：npm install express cors node-fetch
 * 启动：GITHUB_TOKEN=ghp_xxx node server.js
 *
 * 环境变量：
 *   PORT=3000
 *   GITHUB_TOKEN=ghp_xxx   (必填，你自己的 GitHub Token，需要 gist 权限)
 *   ACCESS_TOKEN=xxx        (可选，限制谁能访问这个服务器)
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const GIST_API = 'https://api.github.com/gists';
const GIST_FILENAME = 'jianfei-data.json';
const MAP_FILE = path.join(__dirname, 'mapping.json');

if (!GITHUB_TOKEN) {
    console.warn('⚠️  警告：未设置 GITHUB_TOKEN，云同步功能将无法使用');
}

// ── 用 JSON 文件存 userId → gistId 映射（替代 SQLite）──────
function readMap() {
    try { return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')); } catch { return {}; }
}
function writeMap(map) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
}

// ── App ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

function auth(req, res, next) {
    if (!ACCESS_TOKEN) return next();
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (token !== ACCESS_TOKEN) return res.status(401).json({ error: '无效的访问令牌' });
    next();
}

function githubFetch(url, options = {}) {
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
    const map = readMap();
    let gistId = map[userId];

    try {
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
                map[userId] = gistId;
                writeMap(map);
                return res.json({ ok: true });
            }
        }

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `GitHub 返回 ${resp.status}`);
        }

        res.json({ ok: true });
    } catch (e) {
        console.error('备份失败:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── 恢复备份 ──────────────────────────────────────────────
app.get('/api/restore/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    if (!GITHUB_TOKEN) return res.status(503).json({ error: '服务器未配置 GitHub Token' });

    const map = readMap();
    const gistId = map[userId];
    if (!gistId) return res.status(404).json({ error: '没有找到你的备份，请先上传一次' });

    try {
        const resp = await githubFetch(`${GIST_API}/${gistId}`);
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

app.get('/api/health', (req, res) => {
    res.json({ ok: true, githubReady: !!GITHUB_TOKEN });
});

app.listen(PORT, () => {
    console.log(`减肥助手服务器 → http://localhost:${PORT}`);
    console.log(`GitHub 同步：${GITHUB_TOKEN ? '✅ 已配置' : '❌ 未配置 GITHUB_TOKEN'}`);
});
