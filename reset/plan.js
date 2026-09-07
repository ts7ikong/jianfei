// 30天身体状态重置 - 计划数据
const PLAN = {
  name: "30天身体状态重置",
  START_DATE: "2026-09-07",
  TOTAL_DAYS: 30,

  baseline: {
    height_cm: 180, weight_kg: 76, waist_cm: 95,
    age: 28, gender: "male", activity: "very_low",
    occupation: "programmer",
  },

  phases: [
    { id: 1, days: [1, 7],   name: "启动期", label: "Phase 1 · 启动",
      goal: "让身体动起来，建立基础运动习惯",
      training_min: 30, walking_min: 40,
      sleep_target: "01:30", dinner_target: "21:00",
      color: "#10b981" },
    { id: 2, days: [8, 14],  name: "节奏期", label: "Phase 2 · 节奏",
      goal: "建立稳定节奏，逐步提高运动量",
      training_min: 40, walking_min: 45,
      sleep_target: "01:00", dinner_target: "20:30",
      color: "#3b82f6" },
    { id: 3, days: [15, 21], name: "减脂期", label: "Phase 3 · 减脂",
      goal: "进入真正减脂阶段，增加运动强度",
      training_min: 45, walking_min: 50,
      sleep_target: "00:30", dinner_target: "20:30",
      color: "#8b5cf6" },
    { id: 4, days: [22, 30], name: "精调期", label: "Phase 4 · 精调",
      goal: "稳定巩固，精细调整",
      training_min: 50, walking_min: 50,
      sleep_target: "00:00", dinner_target: "20:00",
      color: "#f59e0b" },
  ],

  exercises: {
    1: [
      { id: "squat",         name: "深蹲",       sets: 3, reps: 10, unit: "次",    tip: "双脚与肩同宽，膝盖对准脚尖，大腿平行地面" },
      { id: "glute_bridge",  name: "臀桥",       sets: 3, reps: 15, unit: "次",    tip: "肩胛骨着地，臀部收紧上推，顶峰保持1秒" },
      { id: "pushup",        name: "俯卧撑",     sets: 3, reps: 8,  unit: "次",    tip: "身体保持一条直线，核心收紧" },
      { id: "dead_bug",      name: "死虫",       sets: 3, reps: 8,  unit: "次/侧", tip: "腰部贴地，对侧手脚缓慢伸展" },
      { id: "plank",         name: "平板支撑",   sets: 3, reps: 20, unit: "秒",    tip: "核心收紧，臀部不高不低，均匀呼吸" },
      { id: "wall_angel",    name: "墙天使",     sets: 3, reps: 10, unit: "次",    tip: "背部、头部、手臂贴墙，缓慢上举" },
    ],
    2: [
      { id: "squat",          name: "深蹲",       sets: 3, reps: 12, unit: "次",    tip: "腿部感到有些酸" },
      { id: "glute_bridge",   name: "臀桥",       sets: 3, reps: 18, unit: "次",    tip: "顶峰保持1-2秒" },
      { id: "pushup",         name: "俯卧撑",     sets: 3, reps: 10, unit: "次",    tip: "如果太难可以跪姿" },
      { id: "dead_bug",       name: "死虫",       sets: 3, reps: 10, unit: "次/侧", tip: "核心全程不离地" },
      { id: "plank",          name: "平板支撑",   sets: 3, reps: 30, unit: "秒",    tip: "" },
      { id: "wall_angel",     name: "墙天使",     sets: 3, reps: 12, unit: "次",    tip: "" },
      { id: "reverse_lunge",  name: "反向箭步蹲", sets: 3, reps: 8,  unit: "次/侧", tip: "后腿膝盖轻触地面" },
      { id: "backpack_row",   name: "背包划船",   sets: 3, reps: 10, unit: "次",    tip: "背包装重物，单臂或双臂划船" },
    ],
    3: [
      { id: "squat",          name: "深蹲",       sets: 3, reps: 15, unit: "次" },
      { id: "glute_bridge",   name: "臀桥",       sets: 3, reps: 20, unit: "次" },
      { id: "pushup",         name: "俯卧撑",     sets: 3, reps: 12, unit: "次" },
      { id: "dead_bug",       name: "死虫",       sets: 3, reps: 12, unit: "次/侧" },
      { id: "plank",          name: "平板支撑",   sets: 3, reps: 40, unit: "秒" },
      { id: "wall_angel",     name: "墙天使",     sets: 3, reps: 15, unit: "次" },
      { id: "reverse_lunge",  name: "反向箭步蹲", sets: 3, reps: 10, unit: "次/侧" },
      { id: "backpack_row",   name: "背包划船",   sets: 3, reps: 12, unit: "次" },
      { id: "bird_dog",       name: "鸟狗",       sets: 3, reps: 10, unit: "次/侧", tip: "对侧手脚同时伸展，保持腰部稳定" },
    ],
    4: [
      { id: "squat",          name: "深蹲",       sets: 4, reps: 15, unit: "次" },
      { id: "glute_bridge",   name: "臀桥",       sets: 4, reps: 20, unit: "次" },
      { id: "pushup",         name: "俯卧撑",     sets: 4, reps: 12, unit: "次" },
      { id: "dead_bug",       name: "死虫",       sets: 3, reps: 12, unit: "次/侧" },
      { id: "plank",          name: "平板支撑",   sets: 3, reps: 45, unit: "秒" },
      { id: "wall_angel",     name: "墙天使",     sets: 3, reps: 15, unit: "次" },
      { id: "reverse_lunge",  name: "反向箭步蹲", sets: 3, reps: 12, unit: "次/侧" },
      { id: "backpack_row",   name: "背包划船",   sets: 3, reps: 12, unit: "次" },
      { id: "bird_dog",       name: "鸟狗",       sets: 3, reps: 12, unit: "次/侧" },
    ],
  },

  tasks: [
    { id: "exercise",          name: "力量训练",     category: "运动", emoji: "💪" },
    { id: "walking",           name: "快走",         category: "运动", emoji: "🚶" },
    { id: "no_sugary_drinks",  name: "无含糖饮料",   category: "饮食", emoji: "🚫" },
    { id: "no_late_snack",     name: "不吃夜宵",     category: "饮食", emoji: "🌙" },
    { id: "early_dinner",      name: "晚餐提前",     category: "饮食", emoji: "🍽️" },
    { id: "hydration",         name: "饮水2L+",      category: "生活", emoji: "💧" },
    { id: "sit_breaks",        name: "久坐打断",     category: "生活", emoji: "⏰" },
    { id: "posture_training",  name: "体态训练",     category: "生活", emoji: "🧍" },
    { id: "skincare",          name: "护肤",         category: "护理", emoji: "✨" },
    { id: "scalp_care",        name: "头皮护理",     category: "护理", emoji: "💆" },
    { id: "scrotal_care",      name: "阴囊干燥管理", category: "护理", emoji: "🩱" },
  ],

  score_labels: {
    face_oiliness:    ["", "6h+不油", "4-6h后", "2-4h后", "1-2h出油", "<1h很油"],
    scalp_oiliness:   ["", "2天+不油", "约2天后", "1天后油", "半天就油", "几小时油"],
    hair_shedding:    ["", "明显减少", "较少", "正常", "较多", "非常明显"],
    dry_mouth:        ["", "完全没有", "偶尔", "比较频繁", "一直口干", "严重影响"],
    scrotal_moisture: ["", "完全干燥", "偶尔", "轻微", "明显", "经常很湿"],
    sleep_quality:    ["", "很差", "较差", "一般", "较好", "很好"],
    energy_level:     ["", "极度疲惫", "疲倦", "一般", "精力好", "非常好"],
    shoulder:         ["", "严重前扣", "明显前扣", "轻微前扣", "基本正常", "完美"],
    hunchback:        ["", "严重", "明显", "轻微", "基本正常", "挺拔"],
  },

  // 评分指导说明（显示在评分栏上方）
  scale_hints: {
    face_oiliness:  "洗脸后几小时开始出油？",
    scalp_oiliness: "洗头后几天开始出油？",
    hair_shedding:  "对比上周，掉发量变化？",
    dry_mouth:      "今天整体口干程度",
    scrotal_moisture: "今天整体干燥程度",
    sleep_quality:  "昨晚睡眠感受",
    energy_level:   "起床时的精神状态",
  },

  rpe_labels: ["", "极轻松", "轻松", "稍微累", "中等", "有些累", "偏累", "很累", "辛苦", "非常辛苦", "极限"],

  incomplete_reasons: [
    "加班", "太累", "生病/不舒服", "下雨", "游戏时间过长",
    "临时有事", "忘记了", "懒得做", "其他",
  ],

  pain_locations: ["肌肉酸痛", "关节疼痛", "腰背疼痛", "膝盖疼痛", "肩膀疼痛", "其他"],

  danger_signs: ["胸痛", "晕厥", "异常呼吸困难", "明显头晕"],
};

// ── helpers ──────────────────────────────────────────────────
function getPhase(day) {
  return PLAN.phases.find(p => day >= p.days[0] && day <= p.days[1]) || PLAN.phases[0];
}

function getExercises(day) {
  const p = getPhase(day);
  return PLAN.exercises[p.id] || PLAN.exercises[1];
}

function currentDay() {
  const start = new Date(PLAN.START_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000) + 1;
  return Math.max(1, Math.min(diff, PLAN.TOTAL_DAYS));
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function emptyDayRecord(date, day) {
  const exercises = getExercises(day);
  const exerciseMap = {};
  exercises.forEach(ex => {
    exerciseMap[ex.id] = { sets_done: Array(ex.sets).fill(false), actual_reps: [] };
  });
  const taskMap = {};
  PLAN.tasks.forEach(t => { taskMap[t.id] = { done: null, reason: null }; });

  return {
    date, day,
    body:      { weight_kg: null, waist_cm: null },
    sleep:     { bed_time: "", wake_time: "", duration_hours: null, quality: null, energy: null },
    exercise:  { planned_minutes: getPhase(day).training_min, actual_minutes: null, rpe: null,
                 walking_minutes: null, pain: { has_pain: false, locations: [], notes: "" },
                 exercises: exerciseMap },
    diet:      { breakfast: { eaten: null, description: "" },
                 lunch:    { protein: null, vegetables: null, carbs: null, fruit: null },
                 dinner:   { protein: null, vegetables: null, carbs: null, finish_time: "", overeating: false },
                 sugary_drinks: null, late_night: null, alcohol: null, snacks: null, water_liters: null },
    skin:      { face_oiliness: null, new_pimples: null },
    scalp:     { oiliness: null, hair_shedding: null },
    other:     { dry_mouth: null, scrotal_moisture: null, dry_mouth_notes: "" },
    posture:   { shoulder: null, hunchback: null },
    sedentary: { breaks: null, max_continuous_minutes: null },
    tasks:     taskMap,
    notes:     "",
    submitted: false,
    submitted_at: null,
  };
}

function calcSleepHours(bedTime, wakeTime) {
  if (!bedTime || !wakeTime) return null;
  const [bh, bm] = bedTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440;
  return Math.round(mins / 6) / 10;
}

function completionRate(record) {
  const tasks = Object.values(record.tasks);
  const total = tasks.length;
  const done = tasks.filter(t => t.done === true).length;
  return total ? Math.round(done / total * 100) : 0;
}
