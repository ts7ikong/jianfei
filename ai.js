/* ai.js — 通义千问 API + Web Speech 语音输入 + 图片识别 */

const AI = (() => {
    const API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    const MODEL_TEXT = 'qwen-turbo';      // 文字对话（快速省钱）
    const MODEL_VISION = 'qwen-vl-plus';  // 图片识别

    // ── 通用请求 ─────────────────────────────────────────
    async function callQwen(model, messages, apiKey) {
        const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, messages, max_tokens: 1024 }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg = err.error?.message || err.message || `API 错误 ${resp.status}`;
            throw new Error(msg);
        }

        const data = await resp.json();
        return data.choices[0].message.content;
    }

    // ── 解析用户文字输入 ─────────────────────────────────
    async function parseInput(text, context) {
        const { consumed, target, burned, remaining } = context;
        const system = `你是减肥助手AI，帮用户记录饮食和运动，追踪热量缺口。
只返回合法JSON，不含其他文字。

格式：
{
  "type": "food" | "exercise" | "advice" | "unknown",
  "message": "对用户说的话（中文，不超过30字）",
  "items": [{ "name": "食物名", "amount": "数量描述", "calories": 整数 }],
  "exercise": { "name": "运动名", "duration": 分钟数, "calories": 消耗整数 }
}

规则：
- food：用户提到吃东西，填 items（可多个），calories 必须是整数
- exercise：用户提到运动，填 exercise
- advice：用户问建议/问能吃什么/问状态
- 热量按中国标准估算（米饭100g≈130kcal，鸡蛋1个≈70kcal）
- message 友好鼓励`;

        const userMsg = `用户说："${text}"
今日已摄入：${consumed}kcal，运动消耗：${burned}kcal，目标：${target}kcal，剩余：${remaining}kcal`;

        const raw = await callQwen(MODEL_TEXT, [
            { role: 'system', content: system },
            { role: 'user', content: userMsg },
        ], Storage.getApiKey());

        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('AI返回格式异常，请重试');
        return JSON.parse(match[0]);
    }

    // ── 图片 + 文字识别食物 ──────────────────────────────
    async function analyzeImage(imageDataUrl, userText, context) {
        const { consumed, target, burned, remaining } = context;

        const textPart = userText ? `用户同时说："${userText}"` : '';

        const forcedItems = textPart
            ? `\n\n【强制要求】用户说了："${userText}"，其中提到的每一种食物都必须出现在 items 列表里，即使图片里看不到。漏掉任何一种都是错误。`
            : '';

        const prompt = `分析图片中的食物，返回合法JSON（不含其他文字）：

{
  "type": "food",
  "message": "简短说明（中文，不超过30字）",
  "items": [{ "name": "食物名", "amount": "估算分量", "calories": 整数 }]
}

步骤：
第一步：识别图片中所有可见食物，每种单独一条加入 items。
第二步：${textPart ? `用户文字提到了"${userText}"，将其中每一种食物逐一检查，若 items 里没有则【立即补充进去】，绝对不能遗漏。` : '无用户文字，仅识别图片。'}
第三步：删除 items 中既不在图片里、用户也没提到的食材。
第四步：按中国标准估算每项 calories（整数）。${forcedItems}

今日已摄入${consumed}kcal，目标${target}kcal，剩余${remaining}kcal`;

        const raw = await callQwen(MODEL_VISION, [{
            role: 'user',
            content: [
                { type: 'image_url', image_url: { url: imageDataUrl } },
                { type: 'text', text: prompt },
            ],
        }], Storage.getApiKey());

        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('图片识别失败，请重试');
        return JSON.parse(match[0]);
    }

    // ── 每日建议 ─────────────────────────────────────────
    async function getDailyAdvice(context) {
        const { consumed, target, burned, remaining } = context;
        const msg = `已摄入${consumed}kcal，目标${target}kcal，运动消耗${burned}kcal，剩余${remaining}kcal。
给出一句简短鼓励或建议（不超过35字，中文，只回这一句话）`;
        return callQwen(MODEL_TEXT, [{ role: 'user', content: msg }], Storage.getApiKey());
    }

    // ── 语音输入 ─────────────────────────────────────────
    let recognition = null;
    let isRecording = false;

    function isVoiceSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    function startVoice(onResult, onError, onStart) {
        if (!isVoiceSupported()) {
            onError('当前浏览器不支持语音输入，请使用 Chrome 或 Safari');
            return;
        }
        if (isRecording) { stopVoice(); return; }

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => { isRecording = true; if (onStart) onStart(); };
        recognition.onresult = (e) => {
            isRecording = false;
            recognition = null;
            onResult(e.results[0][0].transcript);
        };
        recognition.onerror = (e) => {
            isRecording = false;
            recognition = null;
            const msgs = {
                'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许',
                'no-speech': '没有检测到声音，请重试',
                'network': '网络错误，请检查连接',
            };
            onError(msgs[e.error] || `语音识别失败: ${e.error}`);
        };
        recognition.onend = () => { isRecording = false; recognition = null; };
        recognition.start();
    }

    function stopVoice() {
        if (recognition) { recognition.stop(); recognition = null; }
        isRecording = false;
    }

    function getIsRecording() { return isRecording; }

    return { parseInput, analyzeImage, getDailyAdvice, startVoice, stopVoice, getIsRecording, isVoiceSupported };
})();
