/* calculator.js — TDEE / BMR / deficit math */

const Calculator = (() => {

    // Harris-Benedict BMR
    function bmr(profile) {
        const { gender, weight, height, age } = profile;
        if (gender === 'male') {
            return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
        }
        return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
    }

    function tdee(profile) {
        return Math.round(bmr(profile) * Number(profile.activity));
    }

    // Daily calorie target = TDEE - deficit, floored at health minimum
    function dailyTarget(profile) {
        const min = profile.gender === 'female' ? 1200 : 1500;
        return Math.max(min, tdee(profile) - Number(profile.deficit));
    }

    // Consumed calories from today's food log
    function consumed(dayLog) {
        return dayLog.food.reduce((s, f) => s + (f.calories || 0), 0);
    }

    // Exercise calories burned
    function burned(dayLog) {
        return dayLog.exercise.reduce((s, e) => s + (e.calories || 0), 0);
    }

    // Effective remaining = target + exercise - consumed
    function remaining(profile, dayLog) {
        return dailyTarget(profile) + burned(dayLog) - consumed(dayLog);
    }

    // Calorie deficit for a single day (positive = deficit achieved)
    function dayDeficit(profile, dayLog) {
        return tdee(profile) + burned(dayLog) - consumed(dayLog);
    }

    // Total deficit across all log entries
    function totalDeficit(profile, logs) {
        return Object.values(logs).reduce((sum, log) => {
            const c = log.food.reduce((s, f) => s + (f.calories || 0), 0);
            const b = log.exercise.reduce((s, e) => s + (e.calories || 0), 0);
            return sum + tdee(profile) + b - c;
        }, 0);
    }

    // Projected weight loss: 7700 kcal deficit ≈ 1 kg
    function projectedLoss(deficitKcal) {
        return (deficitKcal / 7700).toFixed(2);
    }

    // Arc progress (0–1), capped at 1 for display
    function arcProgress(profile, dayLog) {
        const target = dailyTarget(profile) + burned(dayLog);
        return Math.min(consumed(dayLog) / target, 1);
    }

    // Safety warning: returns message string or null
    function safetyWarning(profile) {
        const target = dailyTarget(profile);
        const rawTarget = tdee(profile) - Number(profile.deficit);
        const min = profile.gender === 'female' ? 1200 : 1500;
        if (rawTarget < min) {
            return `缺口过大，每日目标已自动调整为最低安全值 ${min} kcal`;
        }
        if (Number(profile.deficit) > 750) {
            return '每日缺口超过750kcal，建议放慢节奏，避免肌肉流失';
        }
        return null;
    }

    return { bmr, tdee, dailyTarget, consumed, burned, remaining, dayDeficit, totalDeficit, projectedLoss, arcProgress, safetyWarning };
})();
