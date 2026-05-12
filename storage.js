/* storage.js — localStorage CRUD */

const Storage = (() => {
    const KEYS = {
        PROFILE: 'cc_profile',
        LOGS: 'cc_logs',
        API_KEY: 'cc_api_key',
        SYNC: 'cc_sync',
        USER_ID: 'cc_user_id',
    };

    function _get(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }
    function _set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    // ── Profile ──────────────────────────────────────────
    function getProfile() { return _get(KEYS.PROFILE); }
    function setProfile(p) { _set(KEYS.PROFILE, p); }

    // ── API Key ──────────────────────────────────────────
    function getApiKey() { return localStorage.getItem(KEYS.API_KEY) || ''; }

    // 用 API Key 的哈希作为用户唯一 ID，换设备输同一个 Key 就能找回数据
    function hashApiKey(key) {
        let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
        for (let i = 0; i < key.length; i++) {
            const c = key.charCodeAt(i);
            h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
            h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
        }
        return 'k' + h1.toString(36) + h2.toString(36);
    }

    function setApiKey(k) {
        localStorage.setItem(KEYS.API_KEY, k);
        if (k) localStorage.setItem(KEYS.USER_ID, hashApiKey(k));
    }

    // ── Sync config ──────────────────────────────────────
    function getSyncConfig() { return _get(KEYS.SYNC) || { serverUrl: '' }; }
    function setSyncConfig(c) { _set(KEYS.SYNC, c); }

    // ── 用户唯一ID（由 API Key 哈希派生；若尚未设置 Key 则用随机 ID）──
    function getUserId() {
        let id = localStorage.getItem(KEYS.USER_ID);
        if (!id) {
            id = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
            localStorage.setItem(KEYS.USER_ID, id);
        }
        return id;
    }

    // ── Logs ─────────────────────────────────────────────
    function getLogs() { return _get(KEYS.LOGS) || {}; }
    function _saveLogs(logs) { _set(KEYS.LOGS, logs); }

    function todayKey() { return new Date().toISOString().slice(0, 10); }

    function getDayLog(dateKey) {
        const logs = getLogs();
        return logs[dateKey] || { date: dateKey, food: [], exercise: [], weight: null };
    }

    function getTodayLog() { return getDayLog(todayKey()); }

    function _saveDayLog(dayLog) {
        const logs = getLogs();
        logs[dayLog.date] = dayLog;
        _saveLogs(logs);
    }

    function addFoodEntry(entry, dateKey) {
        const log = getDayLog(dateKey || todayKey());
        log.food.push({
            id: Date.now().toString(36),
            time: new Date().toTimeString().slice(0, 5),
            ...entry,
        });
        _saveDayLog(log);
    }

    function addExerciseEntry(entry, dateKey) {
        const log = getDayLog(dateKey || todayKey());
        log.exercise.push({
            id: Date.now().toString(36),
            time: new Date().toTimeString().slice(0, 5),
            ...entry,
        });
        _saveDayLog(log);
    }

    function setTodayWeight(kg) {
        const log = getTodayLog();
        log.weight = kg;
        _saveDayLog(log);
        // also update profile weight
        const p = getProfile();
        if (p) { p.weight = kg; setProfile(p); }
    }

    function deleteFoodEntry(id) {
        const log = getTodayLog();
        log.food = log.food.filter(f => f.id !== id);
        _saveDayLog(log);
    }

    function deleteExerciseEntry(id) {
        const log = getTodayLog();
        log.exercise = log.exercise.filter(e => e.id !== id);
        _saveDayLog(log);
    }

    // ── Aggregate helpers ─────────────────────────────────
    function getWeekLogs() {
        const logs = getLogs();
        const result = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push(logs[key] || { date: key, food: [], exercise: [], weight: null });
        }
        return result;
    }

    function getMonthLogs(year, month) {
        const logs = getLogs();
        const result = [];
        const days = new Date(year, month, 0).getDate();
        for (let d = 1; d <= days; d++) {
            const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (logs[key]) result.push(logs[key]);
        }
        return result;
    }

    // ── Export / Import ──────────────────────────────────
    function exportAll() {
        return {
            profile: getProfile(),
            logs: getLogs(),
            exportedAt: new Date().toISOString(),
        };
    }

    function importAll(data) {
        if (data.profile) setProfile(data.profile);
        if (data.logs) _saveLogs(data.logs);
    }

    function clearAll() {
        localStorage.removeItem(KEYS.PROFILE);
        localStorage.removeItem(KEYS.LOGS);
    }

    return {
        getProfile, setProfile,
        getApiKey, setApiKey,
        getSyncConfig, setSyncConfig,
        getUserId,
        getTodayLog, getDayLog, getLogs,
        addFoodEntry, addExerciseEntry,
        setTodayWeight,
        deleteFoodEntry, deleteExerciseEntry,
        getWeekLogs, getMonthLogs,
        exportAll, importAll, clearAll,
        todayKey,
    };
})();
