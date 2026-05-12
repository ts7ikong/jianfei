/* app.js — main controller */

// ── State ────────────────────────────────────────────────
let pendingAIResult = null;   // parsed AI result waiting for confirmation
let chartMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const profile = Storage.getProfile();
    if (profile) {
        showApp();
    } else {
        showOnboarding();
    }
});

// ── Onboarding ────────────────────────────────────────────
let obStep = 1;
let obGender = 'male';
let obActivity = 1.55;
let obDeficit = 500;

function showOnboarding() {
    document.getElementById('onboarding').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    renderObStep(1);
}

function renderObStep(step) {
    obStep = step;
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');

    document.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i < step);
    });

    document.getElementById('ob-back').classList.toggle('hidden', step === 1);
    const nextBtn = document.getElementById('ob-next');
    nextBtn.textContent = step === 4 ? '开始使用' : '下一步';

    if (step === 3) updateObTDEE();
}

function updateObTDEE() {
    const profile = getObProfile();
    if (!profile) return;
    const t = Calculator.tdee(profile);
    const target = Calculator.dailyTarget(profile);
    document.getElementById('tdee-display').textContent = `${t} kcal`;
    document.getElementById('target-display').textContent = `${target} kcal`;
}

function getObProfile() {
    const name = document.getElementById('ob-name').value.trim();
    const age = parseInt(document.getElementById('ob-age').value);
    const height = parseFloat(document.getElementById('ob-height').value);
    const weight = parseFloat(document.getElementById('ob-weight').value);
    if (!name || !age || !height || !weight) return null;
    return { name, gender: obGender, age, height, weight, activity: obActivity, deficit: obDeficit };
}

function validateObStep(step) {
    if (step === 1) {
        const name = document.getElementById('ob-name').value.trim();
        const age = document.getElementById('ob-age').value;
        const height = document.getElementById('ob-height').value;
        const weight = document.getElementById('ob-weight').value;
        if (!name) { showToast('请输入你的名字'); return false; }
        if (!age || age < 10 || age > 100) { showToast('请输入有效年龄'); return false; }
        if (!height || height < 100) { showToast('请输入有效身高'); return false; }
        if (!weight || weight < 30) { showToast('请输入有效体重'); return false; }
    }
    return true;
}

document.getElementById('ob-next').addEventListener('click', () => {
    if (!validateObStep(obStep)) return;
    if (obStep < 4) {
        renderObStep(obStep + 1);
    } else {
        // Save and start
        const profile = getObProfile();
        if (!profile) { showToast('请完善基本信息'); renderObStep(1); return; }
        Storage.setProfile(profile);
        const apiKey = document.getElementById('ob-apikey').value.trim();
        if (apiKey) Storage.setApiKey(apiKey);
        showApp();
    }
});

document.getElementById('ob-back').addEventListener('click', () => {
    if (obStep > 1) renderObStep(obStep - 1);
});

// Onboarding radio / select listeners
document.querySelectorAll('.radio-option').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.radio-option').forEach(r => r.classList.remove('active'));
        el.classList.add('active');
        obGender = el.dataset.val;
        if (obStep === 3) updateObTDEE();
    });
});

document.querySelectorAll('.activity-item').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.activity-item').forEach(a => a.classList.remove('active'));
        el.classList.add('active');
        obActivity = parseFloat(el.dataset.val);
        if (obStep === 3) updateObTDEE();
    });
});

document.querySelectorAll('.deficit-item').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.deficit-item').forEach(d => d.classList.remove('active'));
        el.classList.add('active');
        obDeficit = parseInt(el.dataset.val);
        updateObTDEE();
    });
});

// ── App Shell ─────────────────────────────────────────────
function showApp() {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
}

function initApp() {
    renderTodayPage();
    initTrendPage();
    loadSettingsPage();
    bindInputBar();
    bindTabs();
    bindModals();
    bindSettings();
    fetchDailyAdvice();
}

// ── Tab Navigation ────────────────────────────────────────
function bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');

            // Input bar only on today page
            document.getElementById('input-bar').style.display = page === 'today' ? '' : 'none';

            if (page === 'trend') renderTrendPage();
        });
    });
}

// ── Today Page ────────────────────────────────────────────
function renderTodayPage() {
    const profile = Storage.getProfile();
    if (!profile) return;

    const dayLog = Storage.getTodayLog();
    const consumed = Calculator.consumed(dayLog);
    const burned = Calculator.burned(dayLog);
    const target = Calculator.dailyTarget(profile);
    const remaining = Calculator.remaining(profile, dayLog);

    // Greeting
    const hour = new Date().getHours();
    const greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    document.getElementById('greeting-text').textContent = `${greet}，${profile.name}！`;
    document.getElementById('date-text').textContent = formatDate(new Date());

    // Ring stats
    document.getElementById('ring-consumed').textContent = consumed;
    document.getElementById('stat-target').textContent = target;
    document.getElementById('stat-burned').textContent = burned;
    const remEl = document.getElementById('stat-remaining');
    remEl.textContent = remaining;
    remEl.style.color = remaining < 0 ? 'var(--red)' : '';

    // Arc animation
    const progress = Calculator.arcProgress(profile, dayLog);
    const circumference = 553;
    const arc = document.getElementById('calorie-arc');
    const arcOver = document.getElementById('calorie-arc-over');

    if (consumed <= target + burned) {
        arc.classList.remove('hidden');
        arcOver.classList.add('hidden');
        arc.style.strokeDashoffset = circumference * (1 - progress);
    } else {
        arc.classList.add('hidden');
        arcOver.classList.remove('hidden');
        arcOver.style.strokeDashoffset = 0;
    }

    // Log list
    renderLogList(dayLog);
}

function renderLogList(dayLog) {
    const list = document.getElementById('log-list');
    const empty = document.getElementById('log-empty');

    const allItems = [
        ...dayLog.food.map(f => ({ ...f, _type: 'food' })),
        ...dayLog.exercise.map(e => ({ ...e, _type: 'exercise' })),
    ].sort((a, b) => a.time.localeCompare(b.time));

    if (allItems.length === 0) {
        empty.classList.remove('hidden');
        // Clear old items except empty state
        Array.from(list.children).forEach(c => { if (c !== empty) c.remove(); });
        return;
    }

    empty.classList.add('hidden');
    Array.from(list.children).forEach(c => { if (c !== empty) c.remove(); });

    allItems.forEach(item => {
        const el = document.createElement('div');
        el.className = 'log-item';
        el.dataset.id = item.id;
        el.dataset.type = item._type;

        if (item._type === 'food') {
            el.innerHTML = `
                <span class="log-icon">🍽️</span>
                <div class="log-body">
                    <div class="log-name">${escHtml(item.name)}</div>
                    <div class="log-meta">${item.time} · ${escHtml(item.amount || '')}</div>
                </div>
                <span class="log-kcal food-kcal">${item.calories} kcal</span>
                <button class="log-del" data-id="${item.id}" data-type="food">✕</button>`;
        } else {
            el.innerHTML = `
                <span class="log-icon">🏃</span>
                <div class="log-body">
                    <div class="log-name">${escHtml(item.name)}</div>
                    <div class="log-meta">${item.time} · ${item.duration || 0} 分钟</div>
                </div>
                <span class="log-kcal exercise-kcal">+${item.calories} kcal</span>
                <button class="log-del" data-id="${item.id}" data-type="exercise">✕</button>`;
        }

        list.appendChild(el);
    });

    // Delete buttons
    list.querySelectorAll('.log-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const { id, type } = btn.dataset;
            if (type === 'food') Storage.deleteFoodEntry(id);
            else Storage.deleteExerciseEntry(id);
            renderTodayPage();
        });
    });
}

// ── AI Banner ─────────────────────────────────────────────
async function fetchDailyAdvice() {
    if (!Storage.getApiKey()) return;
    const profile = Storage.getProfile();
    if (!profile) return;
    const dayLog = Storage.getTodayLog();
    const context = buildContext(profile, dayLog);
    try {
        const advice = await AI.getDailyAdvice(context);
        const banner = document.getElementById('ai-banner');
        document.getElementById('ai-banner-msg').textContent = advice;
        banner.classList.remove('hidden');
    } catch (e) {
        // Silently fail — advice is non-critical
    }
}

function buildContext(profile, dayLog) {
    return {
        consumed: Calculator.consumed(dayLog),
        burned: Calculator.burned(dayLog),
        target: Calculator.dailyTarget(profile),
        remaining: Calculator.remaining(profile, dayLog),
    };
}

// ── Input Bar ─────────────────────────────────────────────
let pendingImageDataUrl = null;

function bindInputBar() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send');
    const micBtn = document.getElementById('btn-mic');
    const camBtn = document.getElementById('btn-camera');
    const fileInput = document.getElementById('file-camera');

    sendBtn.addEventListener('click', () => submitInput(input.value.trim()));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitInput(input.value.trim());
    });

    // 相机按钮
    camBtn.addEventListener('click', () => {
        if (pendingImageDataUrl) {
            clearImagePreview();
        } else {
            fileInput.click();
        }
    });

    // 文件选择完成（拍照或从相册选取）
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        fileInput.value = '';

        const reader = new FileReader();
        reader.onload = (ev) => {
            pendingImageDataUrl = ev.target.result;
            showImagePreview(pendingImageDataUrl);
            showToast('照片已附加，可补充描述后发送');
        };
        reader.readAsDataURL(file);
    });

    // 移除图片预览
    document.getElementById('btn-img-remove').addEventListener('click', clearImagePreview);

    // 语音按钮
    micBtn.addEventListener('click', () => {
        if (AI.getIsRecording()) {
            AI.stopVoice();
            micBtn.classList.remove('recording');
            return;
        }
        AI.startVoice(
            (text) => {
                micBtn.classList.remove('recording');
                input.value = text;
                submitInput(text);
            },
            (err) => {
                micBtn.classList.remove('recording');
                showToast(err);
            },
            () => {
                micBtn.classList.add('recording');
                showToast('正在录音，说完后自动识别...');
            }
        );
    });
}

function showImagePreview(dataUrl) {
    const bar = document.getElementById('img-preview-bar');
    document.getElementById('img-preview').src = dataUrl;
    bar.classList.remove('hidden');
    document.getElementById('input-bar').classList.add('has-preview');
    document.getElementById('btn-camera').classList.add('has-image');
    document.getElementById('btn-camera').title = '移除图片';
}

function clearImagePreview() {
    pendingImageDataUrl = null;
    document.getElementById('img-preview-bar').classList.add('hidden');
    document.getElementById('input-bar').classList.remove('has-preview');
    document.getElementById('btn-camera').classList.remove('has-image');
    document.getElementById('btn-camera').title = '拍照识别';
    document.getElementById('img-preview').src = '';
}

async function submitInput(text) {
    if (!text && !pendingImageDataUrl) return;
    const input = document.getElementById('chat-input');
    input.value = '';
    input.blur();

    if (!Storage.getApiKey()) {
        showToast('请先在设置中填写通义千问 API Key');
        return;
    }

    const profile = Storage.getProfile();
    const dayLog = Storage.getTodayLog();
    const context = buildContext(profile, dayLog);

    const hasImage = !!pendingImageDataUrl;
    const imageDataUrl = pendingImageDataUrl;
    if (hasImage) clearImagePreview();

    const loadingMsg = hasImage
        ? '<div class="ai-loading"><div class="spinner"></div>AI 正在识别图片...</div>'
        : '<div class="ai-loading"><div class="spinner"></div>AI 正在理解...</div>';
    showAIModal(loadingMsg);

    try {
        let result;
        if (hasImage) {
            result = await AI.analyzeImage(imageDataUrl, text, context);
        } else {
            result = await AI.parseInput(text, context);
        }
        pendingAIResult = result;
        renderAIModal(result, hasImage ? imageDataUrl : null);
    } catch (e) {
        closeAIModal();
        showToast(`AI 出错：${e.message}`);
    }
}

// ── AI Modal ──────────────────────────────────────────────
function showAIModal(loadingHtml) {
    const modal = document.getElementById('modal-ai');
    modal.classList.remove('hidden');
    document.getElementById('ai-resp-msg').innerHTML = loadingHtml || '';
    document.getElementById('ai-parsed-items').innerHTML = '';
    document.getElementById('ai-modal-btns').classList.add('hidden');
}

function renderAIModal(result, imageDataUrl) {
    // 如果有图片，在消息上方显示缩略图
    const imgHtml = imageDataUrl
        ? `<img src="${imageDataUrl}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;margin-bottom:12px;">`
        : '';
    document.getElementById('ai-resp-msg').innerHTML = imgHtml + escHtml(result.message || '');

    const itemsEl = document.getElementById('ai-parsed-items');
    itemsEl.innerHTML = '';

    if (result.type === 'food' && result.items?.length) {
        result.items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'parsed-item';
            div.innerHTML = `
                <div>
                    <div class="parsed-item-name">${escHtml(item.name)}</div>
                    <div class="parsed-item-meta">${escHtml(item.amount || '')}</div>
                </div>
                <span class="parsed-item-kcal">${item.calories} kcal</span>`;
            itemsEl.appendChild(div);
        });
        document.getElementById('ai-modal-btns').classList.remove('hidden');
        document.getElementById('btn-ai-confirm').textContent = '确认记录';

    } else if (result.type === 'exercise' && result.exercise) {
        const ex = result.exercise;
        const div = document.createElement('div');
        div.className = 'parsed-item';
        div.innerHTML = `
            <div>
                <div class="parsed-item-name">${escHtml(ex.name)}</div>
                <div class="parsed-item-meta">${ex.duration || 0} 分钟</div>
            </div>
            <span class="parsed-item-kcal" style="color:var(--green)">消耗 ${ex.calories} kcal</span>`;
        itemsEl.appendChild(div);
        document.getElementById('ai-modal-btns').classList.remove('hidden');
        document.getElementById('btn-ai-confirm').textContent = '确认记录';

    } else {
        // advice or unknown — no confirm needed, just close
        document.getElementById('ai-modal-btns').classList.remove('hidden');
        document.getElementById('btn-ai-confirm').classList.add('hidden');
        document.getElementById('btn-ai-cancel').textContent = '好的';
    }
}

function closeAIModal() {
    document.getElementById('modal-ai').classList.add('hidden');
    document.getElementById('btn-ai-confirm').classList.remove('hidden');
    document.getElementById('btn-ai-cancel').textContent = '取消';
    pendingAIResult = null;
}

function bindModals() {
    // AI modal
    document.getElementById('btn-ai-cancel').addEventListener('click', closeAIModal);
    document.getElementById('modal-ai').querySelector('.modal-backdrop').addEventListener('click', closeAIModal);

    document.getElementById('btn-ai-confirm').addEventListener('click', () => {
        if (!pendingAIResult) return;
        const result = pendingAIResult;

        if (result.type === 'food' && result.items?.length) {
            result.items.forEach(item => {
                Storage.addFoodEntry({ name: item.name, amount: item.amount || '', calories: item.calories, meal: 'other' });
            });
            showToast('✅ 饮食已记录');
        } else if (result.type === 'exercise' && result.exercise) {
            const ex = result.exercise;
            Storage.addExerciseEntry({ name: ex.name, duration: ex.duration || 0, calories: ex.calories });
            showToast('✅ 运动已记录');
        }

        closeAIModal();
        renderTodayPage();
        fetchDailyAdvice();
    });

    // Weight modal
    document.getElementById('btn-weight-checkin').addEventListener('click', () => {
        const modal = document.getElementById('modal-weight');
        modal.classList.remove('hidden');
        const profile = Storage.getProfile();
        if (profile) document.getElementById('weight-input').value = profile.weight || '';
        document.getElementById('weight-input').focus();
    });

    document.getElementById('btn-weight-cancel').addEventListener('click', () => {
        document.getElementById('modal-weight').classList.add('hidden');
    });
    document.getElementById('modal-weight').querySelector('.modal-backdrop').addEventListener('click', () => {
        document.getElementById('modal-weight').classList.add('hidden');
    });

    document.getElementById('btn-weight-save').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('weight-input').value);
        if (!val || val < 30 || val > 300) { showToast('请输入有效体重'); return; }
        Storage.setTodayWeight(val);
        document.getElementById('modal-weight').classList.add('hidden');
        showToast('✅ 体重已记录');
    });
}

// ── Trend Page ────────────────────────────────────────────
function initTrendPage() {
    document.getElementById('btn-prev-month').addEventListener('click', () => {
        chartMonth.month--;
        if (chartMonth.month < 1) { chartMonth.month = 12; chartMonth.year--; }
        renderTrendPage();
    });
    document.getElementById('btn-next-month').addEventListener('click', () => {
        chartMonth.month++;
        if (chartMonth.month > 12) { chartMonth.month = 1; chartMonth.year++; }
        renderTrendPage();
    });
}

function renderTrendPage() {
    const profile = Storage.getProfile();
    if (!profile) return;

    document.getElementById('chart-month-label').textContent =
        `${chartMonth.year}年${chartMonth.month}月`;

    const monthLogs = Storage.getMonthLogs(chartMonth.year, chartMonth.month);
    drawWeightChart(monthLogs);

    const weekLogs = Storage.getWeekLogs();
    renderWeeklyGoals(weekLogs, profile);
    renderTrendStats(profile, weekLogs);
}

function drawWeightChart(logs) {
    const canvas = document.getElementById('weight-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = 150;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const weights = logs.filter(l => l.weight).map(l => ({
        day: parseInt(l.date.slice(8)),
        w: l.weight,
    }));

    ctx.clearRect(0, 0, W, H);

    if (weights.length < 2) {
        ctx.fillStyle = '#7A8BA0';
        ctx.font = '14px -apple-system, PingFang SC, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('本月暂无体重数据', W / 2, H / 2);
        return;
    }

    const pad = { top: 16, right: 16, bottom: 28, left: 36 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const minW = Math.min(...weights.map(d => d.w)) - 0.5;
    const maxW = Math.max(...weights.map(d => d.w)) + 0.5;
    const maxDay = new Date(chartMonth.year, chartMonth.month, 0).getDate();

    function xOf(day) { return pad.left + ((day - 1) / (maxDay - 1)) * chartW; }
    function yOf(w) { return pad.top + (1 - (w - minW) / (maxW - minW)) * chartH; }

    // Grid lines
    ctx.strokeStyle = '#D5DCE8';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + chartW, y);
        ctx.stroke();

        const wVal = maxW - i * (maxW - minW) / 4;
        ctx.fillStyle = '#7A8BA0';
        ctx.font = '10px -apple-system';
        ctx.textAlign = 'right';
        ctx.fillText(wVal.toFixed(1), pad.left - 4, y + 4);
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, 'rgba(26, 111, 255, 0.25)');
    grad.addColorStop(1, 'rgba(26, 111, 255, 0)');
    ctx.beginPath();
    weights.forEach((d, i) => {
        const x = xOf(d.day), y = yOf(d.w);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(xOf(weights[weights.length - 1].day), pad.top + chartH);
    ctx.lineTo(xOf(weights[0].day), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = '#1A6FFF';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    weights.forEach((d, i) => {
        const x = xOf(d.day), y = yOf(d.w);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    weights.forEach(d => {
        const x = xOf(d.day), y = yOf(d.w);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#1A6FFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function renderWeeklyGoals(weekLogs, profile) {
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const container = document.getElementById('weekly-goals');
    container.innerHTML = '';

    weekLogs.forEach((log, i) => {
        const consumed = Calculator.consumed(log);
        const target = Calculator.dailyTarget(profile);
        const burned = Calculator.burned(log);
        const effectiveTarget = target + burned;
        const hasData = log.food.length > 0 || log.exercise.length > 0;
        const pct = hasData ? Math.round((consumed / effectiveTarget) * 100) : 0;

        let cls = 'empty';
        let label = '';
        if (hasData) {
            if (pct <= 100) { cls = 'done'; label = `${pct}%`; }
            else { cls = 'partial'; label = `${pct}%`; }
        }

        const div = document.createElement('div');
        div.className = 'wg-day';
        div.innerHTML = `
            <div class="wg-circle ${cls}">${label}</div>
            <div class="wg-label">${days[i]}</div>`;
        container.appendChild(div);
    });
}

function renderTrendStats(profile, weekLogs) {
    const logsWithData = weekLogs.filter(l => l.food.length > 0);
    const avgIntake = logsWithData.length
        ? Math.round(logsWithData.reduce((s, l) => s + Calculator.consumed(l), 0) / logsWithData.length)
        : 0;

    const allLogs = Storage.getLogs();
    const total = Calculator.totalDeficit(profile, allLogs);

    document.getElementById('stat-avg-intake').textContent = avgIntake || '--';
    document.getElementById('stat-total-deficit').textContent = total > 0 ? Math.round(total) : '--';
    document.getElementById('stat-projected-loss').textContent =
        total > 0 ? Calculator.projectedLoss(total) : '--';
}

// ── Settings Page ─────────────────────────────────────────
function loadSettingsPage() {
    const profile = Storage.getProfile();
    if (!profile) return;
    document.getElementById('s-name').value = profile.name || '';
    document.getElementById('s-gender').value = profile.gender || 'male';
    document.getElementById('s-age').value = profile.age || '';
    document.getElementById('s-height').value = profile.height || '';
    document.getElementById('s-weight').value = profile.weight || '';
    document.getElementById('s-activity').value = profile.activity || 1.55;
    document.getElementById('s-deficit').value = profile.deficit || 500;

    const apiKey = Storage.getApiKey();
    if (apiKey) document.getElementById('s-apikey').value = apiKey;

    const sync = Storage.getSyncConfig();
    document.getElementById('s-server').value = sync.server || '';
    document.getElementById('s-token').value = sync.token || '';
}

function bindSettings() {
    document.getElementById('btn-save-profile').addEventListener('click', () => {
        const profile = Storage.getProfile() || {};
        profile.name = document.getElementById('s-name').value.trim();
        profile.gender = document.getElementById('s-gender').value;
        profile.age = parseInt(document.getElementById('s-age').value);
        profile.height = parseFloat(document.getElementById('s-height').value);
        profile.weight = parseFloat(document.getElementById('s-weight').value);
        profile.activity = parseFloat(document.getElementById('s-activity').value);
        profile.deficit = parseInt(document.getElementById('s-deficit').value);
        if (!profile.name || !profile.age || !profile.height || !profile.weight) {
            showToast('请填写完整信息'); return;
        }
        Storage.setProfile(profile);
        showToast('✅ 档案已保存');
        renderTodayPage();
    });

    document.getElementById('btn-save-apikey').addEventListener('click', () => {
        const key = document.getElementById('s-apikey').value.trim();
        Storage.setApiKey(key);
        showToast('✅ API Key 已保存');
        if (key) fetchDailyAdvice();
    });

    document.getElementById('btn-sync-up').addEventListener('click', syncUpload);
    document.getElementById('btn-sync-down').addEventListener('click', syncDownload);

    document.getElementById('btn-export').addEventListener('click', () => {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `减肥助手备份_${Storage.todayKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📤 数据已导出');
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if (!confirm('确定清空所有数据？此操作不可恢复')) return;
        Storage.clearAll();
        showToast('数据已清空，即将重新设置');
        setTimeout(() => location.reload(), 1500);
    });
}

// ── Cloud Sync ────────────────────────────────────────────
function getSyncParams() {
    const server = document.getElementById('s-server').value.trim();
    const token = document.getElementById('s-token').value.trim();
    if (!server) { showToast('请填写服务器地址'); return null; }
    Storage.setSyncConfig({ server, token });
    return { server, token };
}

function setSyncStatus(msg) {
    document.getElementById('sync-status').textContent = msg;
}

async function syncUpload() {
    const params = getSyncParams();
    if (!params) return;
    setSyncStatus('上传中...');
    try {
        const resp = await fetch(`${params.server}/api/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${params.token}`,
            },
            body: JSON.stringify(Storage.exportAll()),
        });
        if (!resp.ok) throw new Error(`服务器返回 ${resp.status}`);
        setSyncStatus('✅ 上传成功 ' + new Date().toLocaleTimeString());
        showToast('✅ 数据已上传到云端');
    } catch (e) {
        setSyncStatus('❌ 上传失败：' + e.message);
        showToast('上传失败：' + e.message);
    }
}

async function syncDownload() {
    const params = getSyncParams();
    if (!params) return;
    if (!confirm('从云端恢复会覆盖本地数据，确认继续？')) return;
    setSyncStatus('下载中...');
    try {
        const resp = await fetch(`${params.server}/api/sync`, {
            headers: { 'Authorization': `Bearer ${params.token}` },
        });
        if (!resp.ok) throw new Error(`服务器返回 ${resp.status}`);
        const data = await resp.json();
        Storage.importAll(data);
        setSyncStatus('✅ 恢复成功 ' + new Date().toLocaleTimeString());
        showToast('✅ 数据已从云端恢复');
        renderTodayPage();
        loadSettingsPage();
    } catch (e) {
        setSyncStatus('❌ 下载失败：' + e.message);
        showToast('下载失败：' + e.message);
    }
}

// ── Utilities ─────────────────────────────────────────────
function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function formatDate(d) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 周${days[d.getDay()]}`;
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
