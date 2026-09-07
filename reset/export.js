// Export functions for 30-day reset system
const Export = (() => {

  function scoreLabel(category, val) {
    const labels = PLAN.score_labels[category];
    if (!labels || !val) return val ?? "—";
    return `${val}/5 (${labels[val] || ""})`;
  }

  function yn(v) {
    if (v === true)  return "是";
    if (v === false) return "否";
    return "—";
  }

  function dash(v, suffix = "") { return v != null ? `${v}${suffix}` : "—"; }

  // ── AI 分析数据包 ─────────────────────────────────────────────
  function buildAIPackage(record, records, planVersion) {
    const { day, date, body, sleep, exercise, diet, skin, scalp, other,
            posture, sedentary, tasks, notes } = record;

    const phase = getPhase(day);
    const rate  = completionRate(record);

    // 7-day averages
    const last7 = records.filter(r => r.day <= day).slice(-7);
    const avg7 = key => {
      const vals = last7.map(r => key(r)).filter(v => v != null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "暂无";
    };

    const sleepH = sleep?.duration_hours;
    const sleepStr = sleepH ? `${Math.floor(sleepH)}h${Math.round((sleepH % 1) * 60)}m` : "—";

    const doneTasks = Object.entries(tasks)
      .map(([id, v]) => {
        const t = PLAN.tasks.find(t => t.id === id);
        return `  ${v.done ? "✅" : "❌"} ${t?.name || id}${v.reason ? ` (${v.reason})` : ""}`;
      }).join("\n");

    const exerciseDetails = Object.entries(exercise?.exercises || {}).map(([id, data]) => {
      const ex = getExercises(day).find(e => e.id === id);
      if (!ex) return "";
      const done = data.sets_done.filter(Boolean).length;
      return `  ${ex.name} ${done}/${ex.sets}组 × ${ex.reps}${ex.unit}`;
    }).filter(Boolean).join("\n");

    const lines = [
      "=" .repeat(50),
      `30天身体状态重置 — Day ${day} → Day ${day + 1} AI分析数据`,
      "=".repeat(50),
      "",
      "【基础信息】",
      `身高: ${PLAN.baseline.height_cm}cm`,
      `初始体重: ${PLAN.baseline.weight_kg}kg`,
      `初始腰围: ${PLAN.baseline.waist_cm}cm`,
      `当前阶段: ${phase.label} (${phase.goal})`,
      `当前计划版本: ${planVersion?.version || "v1.0"}`,
      "",
      "【今日身体数据】",
      `体重: ${dash(body?.weight_kg, "kg")}`,
      `腰围: ${dash(body?.waist_cm, "cm")}`,
      "",
      "【睡眠】",
      `入睡: ${sleep?.bed_time || "—"}   起床: ${sleep?.wake_time || "—"}`,
      `睡眠时长: ${sleepStr}`,
      `睡眠质量: ${scoreLabel("sleep_quality", sleep?.quality)}`,
      `起床精神: ${scoreLabel("energy_level", sleep?.energy)}`,
      "",
      "【运动】",
      `计划: 力量训练 ${exercise?.planned_minutes}min + 快走 ${phase.walking_min}min`,
      `实际: 力量训练 ${dash(exercise?.actual_minutes, "min")}  快走 ${dash(exercise?.walking_minutes, "min")}`,
      `RPE: ${exercise?.rpe ? `${exercise.rpe}/10 (${PLAN.rpe_labels[exercise.rpe]})` : "—"}`,
      `疼痛: ${exercise?.pain?.has_pain ? exercise.pain.locations.join("、") || "有" : "无"}`,
      "",
      "力量训练完成情况:",
      exerciseDetails || "  未记录",
      "",
      "【饮食】",
      `早餐: ${diet?.breakfast?.eaten === false ? "未吃" : diet?.breakfast?.description || "—"}`,
      `午餐 蛋白质: ${yn(diet?.lunch?.protein)}  蔬菜: ${yn(diet?.lunch?.vegetables)}  碳水: ${diet?.lunch?.carbs || "—"}  水果: ${yn(diet?.lunch?.fruit)}`,
      `晚餐 蛋白质: ${yn(diet?.dinner?.protein)}  蔬菜: ${yn(diet?.dinner?.vegetables)}  碳水: ${diet?.dinner?.carbs || "—"}  完成时间: ${diet?.dinner?.finish_time || "—"}`,
      `含糖饮料: ${yn(diet?.sugary_drinks)}  夜宵: ${yn(diet?.late_night)}  酒精: ${yn(diet?.alcohol)}`,
      `饮水: ${dash(diet?.water_liters, "L")}`,
      "",
      "【皮肤/头皮】",
      `脸部出油: ${scoreLabel("face_oiliness", skin?.face_oiliness)}`,
      `新增大痘: ${dash(skin?.new_pimples, "个")}`,
      `头皮出油: ${scoreLabel("scalp_oiliness", scalp?.oiliness)}`,
      `掉发自评: ${scoreLabel("hair_shedding", scalp?.hair_shedding)}`,
      "",
      "【其他症状】",
      `口干: ${scoreLabel("dry_mouth", other?.dry_mouth)}`,
      `阴囊潮湿: ${scoreLabel("scrotal_moisture", other?.scrotal_moisture)}`,
      "",
      "【体态】",
      `肩膀: ${scoreLabel("shoulder", posture?.shoulder)}`,
      `驼背: ${scoreLabel("hunchback", posture?.hunchback)}`,
      "",
      "【生活习惯】",
      `久坐打断次数: ${dash(sedentary?.breaks, "次")}`,
      `最长连续久坐: ${dash(sedentary?.max_continuous_minutes, "分钟")}`,
      "",
      "【今日任务完成情况】",
      `总完成率: ${rate}%`,
      doneTasks,
      "",
      "【7日趋势】",
      `7日平均体重: ${avg7(r => r.body?.weight_kg)}kg`,
      `7日平均腰围: ${avg7(r => r.body?.waist_cm)}cm`,
      `7日平均睡眠: ${avg7(r => r.sleep?.duration_hours)}h`,
      `7日平均脸部出油: ${avg7(r => r.skin?.face_oiliness)}/5`,
      `7日平均头皮出油: ${avg7(r => r.scalp?.oiliness)}/5`,
      `7日平均口干: ${avg7(r => r.other?.dry_mouth)}/5`,
      `7日平均阴囊潮湿: ${avg7(r => r.other?.scrotal_moisture)}/5`,
      `7日平均完成率: ${Math.round(last7.map(r => completionRate(r)).reduce((a, b) => a + b, 0) / last7.length)}%`,
      "",
      "【用户备注】",
      notes || "无",
      "",
      "=".repeat(50),
      "请根据以上数据分析:",
      "1. 今日整体执行情况 (优/良/中/差)",
      "2. 体重/腰围趋势判断",
      "3. 运动负荷是否合适 (RPE偏高/偏低/合适)",
      "4. 饮食质量判断",
      "5. 睡眠改善/恶化情况",
      "6. 皮肤/头皮变化趋势 (只分析趋势，不做诊断)",
      "7. 掉发趋势",
      "8. 口干趋势",
      "9. 阴囊潮湿趋势及与久坐/运动的关联",
      "10. 体态改善情况",
      "11. 是否需要调整计划 (保持/增加/降低)",
      "12. 明天具体建议:",
      "    运动: ",
      "    饮食: ",
      "    晚饭: ",
      "    睡眠: ",
      "    体态: ",
      "    久坐: ",
      "    其他: ",
      "=".repeat(50),
    ];
    return lines.join("\n");
  }

  // ── Markdown 日记 ─────────────────────────────────────────────
  function buildMarkdown(record) {
    const { day, date, body, sleep, exercise, skin, scalp, other, notes } = record;
    const rate = completionRate(record);
    const sleepH = sleep?.duration_hours;
    const sleepStr = sleepH ? `${Math.floor(sleepH)}h${Math.round((sleepH % 1) * 60)}m` : "—";

    return [
      `# 30天身体状态重置 — Day ${day}`,
      `> ${formatDate(date)}`,
      "",
      `## 身体数据`,
      `- 体重: ${dash(body?.weight_kg, "kg")}  腰围: ${dash(body?.waist_cm, "cm")}`,
      "",
      `## 睡眠`,
      `- 入睡 ${sleep?.bed_time || "—"} → 起床 ${sleep?.wake_time || "—"} · ${sleepStr}`,
      `- 睡眠质量 ${sleep?.quality || "—"}/5  起床精神 ${sleep?.energy || "—"}/5`,
      "",
      `## 运动`,
      `- 力量训练: ${dash(exercise?.actual_minutes, "min")} (计划 ${exercise?.planned_minutes}min)`,
      `- 快走: ${dash(exercise?.walking_minutes, "min")}`,
      `- RPE: ${exercise?.rpe || "—"}/10`,
      "",
      `## 皮肤/头发`,
      `- 脸部出油 ${skin?.face_oiliness || "—"}/5  新大痘 ${dash(skin?.new_pimples, "个")}`,
      `- 头皮出油 ${scalp?.oiliness || "—"}/5  掉发 ${scalp?.hair_shedding || "—"}/5`,
      `- 口干 ${other?.dry_mouth || "—"}/5  阴囊潮湿 ${other?.scrotal_moisture || "—"}/5`,
      "",
      `## 完成率: ${rate}%`,
      "",
      `## 备注`,
      notes || "无",
    ].join("\n");
  }

  // ── CSV 一行 ─────────────────────────────────────────────────
  function buildCSVRow(record) {
    const r = record;
    return [
      r.date, r.day,
      r.body?.weight_kg   ?? "",
      r.body?.waist_cm    ?? "",
      r.sleep?.bed_time   || "",
      r.sleep?.wake_time  || "",
      r.sleep?.duration_hours ?? "",
      r.sleep?.quality    ?? "",
      r.sleep?.energy     ?? "",
      r.exercise?.actual_minutes  ?? "",
      r.exercise?.walking_minutes ?? "",
      r.exercise?.rpe     ?? "",
      r.skin?.face_oiliness  ?? "",
      r.skin?.new_pimples    ?? "",
      r.scalp?.oiliness      ?? "",
      r.scalp?.hair_shedding ?? "",
      r.other?.dry_mouth     ?? "",
      r.other?.scrotal_moisture ?? "",
      completionRate(r),
      `"${(r.notes || "").replace(/"/g, "'")}"`,
    ].join(",");
  }

  const CSV_HEADER = [
    "date","day","weight_kg","waist_cm","bed_time","wake_time",
    "sleep_hours","sleep_quality","energy","exercise_min","walk_min","rpe",
    "face_oiliness","new_pimples","scalp_oiliness","hair_shedding",
    "dry_mouth","scrotal_moisture","completion_rate","notes"
  ].join(",");

  async function buildFullCSV() {
    const records = (await getAllRecords()).sort((a, b) => a.date.localeCompare(b.date));
    return [CSV_HEADER, ...records.map(buildCSVRow)].join("\n");
  }

  function downloadText(text, filename, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadJSON() {
    const data = await exportAllJSON();
    downloadText(data, `reset30_all_${todayStr()}.json`, "application/json");
  }

  async function downloadCSV() {
    const csv = await buildFullCSV();
    downloadText(csv, `reset30_all_${todayStr()}.csv`, "text/csv");
  }

  function downloadMD(record) {
    downloadText(buildMarkdown(record), `reset30_day${record.day}_${record.date}.md`);
  }

  async function copyAIPackage(record, planVersion) {
    const records = (await getAllRecords()).sort((a, b) => a.date.localeCompare(b.date));
    const text = buildAIPackage(record, records, planVersion);
    await navigator.clipboard.writeText(text);
    return text;
  }

  return { buildAIPackage, buildMarkdown, buildCSVRow, buildFullCSV,
           downloadJSON, downloadCSV, downloadMD, copyAIPackage };
})();
