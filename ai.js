/* ai.js — Claude API integration + Web Speech voice input */

const AI = (() => {
    const MODEL = 'claude-haiku-4-5-20251001';
    const API_URL = 'https://api.anthropic.com/v1/messages';

    // ── Claude API call ──────────────────────────────────
    async function callClaude(systemPrompt, userMessage, apiKey) {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error?.message || `API 错误 ${resp.status}`);
        }

        const data = await resp.json();
        return data.content[0].text;
    }

    // ── Parse user input ─────────────────────────────────
    // Returns: { type, items?, exercise?, message, advice? }
    async function parseInput(text, context) {
        const { consumed, target, burned, remaining } = context;
        const system = `你是一个减肥助手AI，帮用户记录饮食和运动，追踪热量缺口。
回复必须是合法的JSON，不包含任何其他文字。

JSON格式：
{
  "type": "food" | "exercise" | "advice" | "unknown",
  "message": "对用户说的一句话（简洁，中文）",
  "items": [{ "name": "食物名", "amount": "数量描述", "calories": 数字 }],
  "exercise": { "name": "运动名", "duration": 分钟数, "calories": 消耗热量数字 }
}

规则：
- type=food：用户提到吃了东西，items为食物列表（每项calories必须是整数）
- type=exercise：用户提到运动，填exercise字段
- type=advice：用户问建议/问能吃什么/问今天状态
- type=unknown：无法理解
- 热量估算要合理（中国食物标准，米饭100g约130kcal）
- message要友好、鼓励，不超过30字`;

        const userMsg = `用户说："${text}"
今日已摄入：${consumed} kcal
今日运动消耗：${burned} kcal
今日目标：${target} kcal
今日剩余：${remaining} kcal`;

        const raw = await callClaude(system, userMsg, Storage.getApiKey());

        // Extract JSON even if model wraps it in backticks
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('AI返回格式异常');
        return JSON.parse(match[0]);
    }

    // ── Get daily advice ─────────────────────────────────
    async function getDailyAdvice(context) {
        const { consumed, target, burned, remaining } = context;
        const system = `你是减肥助手。根据用户今日数据，给出一句简短鼓励或建议（不超过35字，中文，友好积极）。只回复这一句话，不要JSON。`;
        const msg = `已摄入${consumed}kcal，目标${target}kcal，运动消耗${burned}kcal，剩余${remaining}kcal`;
        return callClaude(system, msg, Storage.getApiKey());
    }

    // ── Voice input ──────────────────────────────────────
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
        if (isRecording) {
            stopVoice();
            return;
        }

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            if (onStart) onStart();
        };

        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            isRecording = false;
            recognition = null;
            onResult(text);
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

        recognition.onend = () => {
            isRecording = false;
            recognition = null;
        };

        recognition.start();
    }

    function stopVoice() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        isRecording = false;
    }

    function getIsRecording() { return isRecording; }

    return { parseInput, getDailyAdvice, startVoice, stopVoice, getIsRecording, isVoiceSupported };
})();
