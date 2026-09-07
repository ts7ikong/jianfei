// 30天身体状态重置 — 主应用逻辑
"use strict";

const App = (() => {
  // ── 状态 ─────────────────────────────────────────────────────
  let state = {
    view: "today",           // today | exercise | trends | export
    day:  1,
    date: "",
    record: null,
    allRecords: [],
    planVersion: null,
    toast: null,
  };

  // ── 初始化 ────────────────────────────────────────────────────
  async function init() {
    await openDB();

    state.day  = currentDay();
    state.date = todayStr();
    state.record      = await getOrCreateRecord(state.date, state.day);
    state.allRecords  = (await getAllRecords()).sort((a, b) => a.date.localeCompare(b.date));
    state.planVersion = await getLatestPlanVersion();

    // 首次运行 → 创建初始计划版本
    if (!state.planVersion) {
      const v0 = {
        version: "v1.0",
        created_at: PLAN.START_DATE,
        applies_from_day: 1,
        changes: ["初始计划"],
        reason: "程序启动，基于用户基础数据生成",
      };
      await savePlanVersion(v0);
      state.planVersion = v0;
    }

    render();
    setupNav();
  }

  // ── 导航 ─────────────────────────────────────────────────────
  function setupNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        if (v !== state.view) { state.view = v; render(); }
      });
    });
  }

  function updateNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === state.view);
    });
  }

  // ── 主渲染 ────────────────────────────────────────────────────
  function render() {
    updateNav();
    const main = document.getElementById("main-content");
    switch (state.view) {
      case "today":    main.innerHTML = renderToday();    break;
      case "exercise": main.innerHTML = renderExercise(); break;
      case "trends":   main.innerHTML = renderTrends();   break;
      case "export":   main.innerHTML = renderExport();   break;
    }
    afterRender();
  }

  function afterRender() {
    switch (state.view) {
      case "today":    bindToday();    break;
      case "exercise": bindExercise(); break;
      case "trends":   bindTrends();   break;
      case "export":   bindExport();   break;
    }
  }

  // ── TODAY 视图 ───────────────────────────────────────────────
  function renderToday() {
    const { day, date, record } = state;
    const phase = getPhase(day);
    const rate  = completionRate(record);
    const daysLeft = PLAN.TOTAL_DAYS - day;

    const bodyStr = [
      record.body.weight_kg ? `${record.body.weight_kg}kg` : null,
      record.body.waist_cm  ? `${record.body.waist_cm}cm` : null,
    ].filter(Boolean).join(" · ") || "未记录";

    const sleepStr = record.sleep.duration_hours
      ? `${Math.floor(record.sleep.duration_hours)}h${Math.round((record.sleep.duration_hours % 1) * 60)}m`
      : "未记录";

    const exStr = record.exercise.actual_minutes
      ? `${record.exercise.actual_minutes}min · RPE ${record.exercise.rpe || "—"}/10`
      : "未记录";

    // ring SVG
    const R = 44, cx = 52, cy = 52, stroke = 8;
    const circumference = 2 * Math.PI * R;
    const dash = circumference * rate / 100;
    const ringColor = rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444";

    const taskCategories = groupBy(PLAN.tasks, t => t.category);

    return `
<div class="page-today">
  <!-- 头部 -->
  <div class="today-header" style="background:${phase.color}15;border-bottom:3px solid ${phase.color}">
    <div class="today-day-info">
      <div class="day-badge" style="background:${phase.color}">DAY ${day}</div>
      <div class="day-meta">
        <div class="day-total">/ ${PLAN.TOTAL_DAYS} &nbsp;·&nbsp; 还剩 ${daysLeft} 天</div>
        <div class="phase-label">${phase.label}</div>
        <div class="date-label">${formatDate(date)}</div>
      </div>
    </div>
    <div class="ring-wrap">
      <svg width="104" height="104">
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ringColor}" stroke-width="${stroke}"
          stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="${circumference * 0.25}"
          stroke-linecap="round" style="transition:stroke-dasharray .6s ease"/>
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="bold" fill="${ringColor}">${rate}%</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#6b7280">完成率</text>
      </svg>
    </div>
  </div>

  <!-- 今日目标 -->
  <div class="card phase-goal">
    <div class="goal-title">📋 今日目标</div>
    <div class="goal-items">
      <span>💪 力量训练 ${phase.training_min}min</span>
      <span>🚶 快走 ${phase.walking_min}min</span>
      <span>🍽️ 晚餐 ${phase.dinner_target}前</span>
      <span>🌙 ${phase.sleep_target}前入睡</span>
    </div>
  </div>

  <!-- 快速数据 -->
  <div class="card">
    <div class="card-title">📊 今日数据</div>
    <div class="quick-stats">
      <div class="qs-item">
        <div class="qs-label">体重/腰围</div>
        <div class="qs-val">${bodyStr}</div>
      </div>
      <div class="qs-item">
        <div class="qs-label">睡眠</div>
        <div class="qs-val">${sleepStr}</div>
      </div>
      <div class="qs-item">
        <div class="qs-label">运动</div>
        <div class="qs-val">${exStr}</div>
      </div>
    </div>
    <button class="btn btn-outline btn-sm" id="btn-morning">
      ${hasMorningData() ? "✏️ 修改早晨记录" : "🌅 录入早晨数据"}
    </button>
  </div>

  <!-- 任务清单 -->
  <div class="card" id="task-card">
    <div class="card-title">✅ 今日任务</div>
    ${Object.entries(taskCategories).map(([cat, tasks]) => `
      <div class="task-category">
        <div class="task-cat-label">${cat}</div>
        ${tasks.map(t => {
          const td = record.tasks[t.id] || {};
          const cls = td.done === true ? "done" : td.done === false ? "skipped" : "";
          return `<div class="task-item ${cls}" data-task="${t.id}">
            <div class="task-check">${td.done === true ? "✓" : td.done === false ? "×" : ""}</div>
            <div class="task-name">${t.emoji} ${t.name}</div>
            ${td.reason ? `<div class="task-reason">${td.reason}</div>` : ""}
          </div>`;
        }).join("")}
      </div>
    `).join("")}
  </div>

  <!-- 身体症状 -->
  <div class="card">
    <div class="card-title">🩺 身体状态</div>
    <div class="symptom-grid">
      ${renderSymptomRow("脸部出油", record.skin?.face_oiliness, "face_oiliness")}
      ${renderSymptomRow("头皮出油", record.scalp?.oiliness, "scalp_oiliness")}
      ${renderSymptomRow("掉发", record.scalp?.hair_shedding, "hair_shedding")}
      ${renderSymptomRow("口干", record.other?.dry_mouth, "dry_mouth")}
      ${renderSymptomRow("干燥管理", record.other?.scrotal_moisture, "scrotal_moisture")}
      ${record.skin?.new_pimples != null ? `<div class="symptom-row"><span>新大痘</span><span>${record.skin.new_pimples}个</span></div>` : ""}
    </div>
    <button class="btn btn-outline btn-sm mt-8" id="btn-morning2">📝 录入/修改症状</button>
  </div>

  <!-- 今晚复盘 -->
  <div class="card">
    <div class="card-title">📝 今日备注</div>
    <textarea class="note-area" id="notes-area" placeholder="今天发生了什么？任何观察都可以记录...">${record.notes || ""}</textarea>
    <button class="btn btn-outline btn-sm mt-8" id="btn-save-notes">保存备注</button>
  </div>

  <!-- 提交 -->
  <div class="submit-section">
    <button class="btn btn-primary btn-lg" id="btn-submit">
      ${record.submitted ? "✅ 已提交（重新提交）" : "📤 提交今日数据"}
    </button>
    ${record.submitted ? `<div class="submitted-at">上次提交: ${record.submitted_at?.slice(11, 16) || ""}</div>` : ""}
  </div>
</div>`;
  }

  function renderSymptomRow(label, val, key) {
    if (val == null) return `<div class="symptom-row muted"><span>${label}</span><span>未记录</span></div>`;
    const desc = PLAN.score_labels[key]?.[val] || "";
    const color = val <= 2 ? "#10b981" : val <= 3 ? "#f59e0b" : "#ef4444";
    return `<div class="symptom-row">
      <span>${label}</span>
      <span style="color:${color}">${val}/5 <small>${desc}</small></span>
    </div>`;
  }

  function hasMorningData() {
    const r = state.record;
    return r.body.weight_kg != null || r.sleep.bed_time || r.skin.face_oiliness != null;
  }

  function bindToday() {
    // 任务点击
    document.querySelectorAll(".task-item").forEach(el => {
      el.addEventListener("click", () => toggleTask(el.dataset.task));
    });
    // 早晨数据
    ["btn-morning", "btn-morning2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => showModal("morning"));
    });
    // 备注保存
    document.getElementById("btn-save-notes")?.addEventListener("click", async () => {
      state.record.notes = document.getElementById("notes-area").value;
      await saveRecord(state.record);
      toast("备注已保存");
    });
    // 提交
    document.getElementById("btn-submit")?.addEventListener("click", submitDay);
  }

  async function toggleTask(taskId) {
    const task = state.record.tasks[taskId];
    if (task.done === null || task.done === false) {
      // 标记完成
      task.done   = true;
      task.reason = null;
    } else {
      // 完成 → 询问未完成原因
      showReasonModal(taskId);
      return;
    }
    await saveRecord(state.record);
    render();
  }

  function showReasonModal(taskId) {
    const taskDef = PLAN.tasks.find(t => t.id === taskId);
    const modal = document.getElementById("modal-reason");
    document.getElementById("modal-reason-title").textContent = `${taskDef?.emoji || ""} ${taskDef?.name || taskId}`;
    modal.dataset.taskId = taskId;
    modal.classList.remove("hidden");
    document.getElementById("modal-overlay").classList.remove("hidden");
  }

  // ── EXERCISE 视图 ────────────────────────────────────────────
  function renderExercise() {
    const { day, record } = state;
    const phase = getPhase(day);
    const exercises = getExercises(day);

    return `
<div class="page-exercise">
  <div class="ex-header">
    <div class="ex-phase-tag" style="background:${phase.color}">${phase.label}</div>
    <h2 class="ex-title">今日训练</h2>
    <div class="ex-meta">计划 ${phase.training_min}min · 快走 ${phase.walking_min}min</div>
  </div>

  <!-- 力量训练 -->
  <div class="card">
    <div class="card-title">💪 力量训练</div>
    <div class="ex-list" id="ex-list">
      ${exercises.map(ex => {
        const data = record.exercise.exercises[ex.id] || { sets_done: Array(ex.sets).fill(false) };
        const doneSets = data.sets_done.filter(Boolean).length;
        const pct = Math.round(doneSets / ex.sets * 100);
        return `
        <div class="ex-item" data-ex="${ex.id}">
          <div class="ex-item-header">
            <div class="ex-name">${ex.name}</div>
            <div class="ex-target">${ex.sets}×${ex.reps}${ex.unit}</div>
          </div>
          ${ex.tip ? `<div class="ex-tip">${ex.tip}</div>` : ""}
          <div class="ex-sets">
            ${Array.from({ length: ex.sets }, (_, i) => `
              <button class="set-btn ${data.sets_done[i] ? "done" : ""}"
                data-ex="${ex.id}" data-set="${i}">
                ${data.sets_done[i] ? "✓" : i + 1}
              </button>
            `).join("")}
            <div class="ex-progress-text">${doneSets}/${ex.sets}</div>
          </div>
          <div class="ex-progress-bar">
            <div class="ex-progress-fill" style="width:${pct}%;background:${pct===100?"#10b981":"#3b82f6"}"></div>
          </div>
        </div>`;
      }).join("")}
    </div>

    <!-- 实际运动数据 -->
    <div class="ex-actual-section">
      <div class="card-title mt-16">📊 实际数据</div>
      <div class="form-grid">
        <div class="form-field">
          <label>实际时长 (分钟)</label>
          <input type="number" id="ex-actual-min" min="0" max="180"
            value="${record.exercise.actual_minutes || ""}" placeholder="${phase.training_min}">
        </div>
        <div class="form-field">
          <label>RPE 强度 <span class="rpe-label" id="rpe-label">${record.exercise.rpe ? PLAN.rpe_labels[record.exercise.rpe] : ""}</span></label>
          <div class="rpe-row">
            ${Array.from({length:10}, (_,i)=>`
              <button class="rpe-btn ${record.exercise.rpe === i+1 ? "active" : ""}" data-rpe="${i+1}">${i+1}</button>
            `).join("")}
          </div>
        </div>
      </div>
    </div>

    <!-- 疼痛记录 -->
    <div class="pain-section">
      <label class="toggle-row">
        <input type="checkbox" id="pain-check" ${record.exercise.pain?.has_pain ? "checked" : ""}>
        <span>今天有运动疼痛</span>
      </label>
      <div id="pain-detail" class="${record.exercise.pain?.has_pain ? "" : "hidden"}">
        <div class="pain-locations">
          ${PLAN.pain_locations.map(loc => `
            <label class="check-pill ${record.exercise.pain?.locations?.includes(loc) ? "active" : ""}">
              <input type="checkbox" name="pain" value="${loc}"
                ${record.exercise.pain?.locations?.includes(loc) ? "checked" : ""}> ${loc}
            </label>
          `).join("")}
        </div>
        <div class="danger-warn" id="danger-warn" style="display:none">
          ⚠️ 如出现胸痛、晕厥、严重头晕，请立即停止训练并就医
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-sm mt-16" id="btn-save-exercise">保存训练数据</button>
  </div>

  <!-- 快走 -->
  <div class="card">
    <div class="card-title">🚶 快走记录</div>
    <div class="form-grid">
      <div class="form-field">
        <label>今日快走 (分钟)</label>
        <input type="number" id="walk-min" min="0" max="120"
          value="${record.exercise.walking_minutes || ""}" placeholder="${phase.walking_min}">
      </div>
    </div>
    <button class="btn btn-outline btn-sm mt-8" id="btn-save-walk">保存快走</button>
  </div>

  <!-- 饮食记录 -->
  <div class="card">
    <div class="card-title">🍽️ 今日饮食</div>

    <div class="meal-section">
      <div class="meal-title">早餐</div>
      <div class="meal-row">
        <label class="radio-pill ${record.diet.breakfast.eaten === false ? "active" : ""}">
          <input type="radio" name="breakfast" value="skip" ${record.diet.breakfast.eaten === false ? "checked" : ""}> 未吃
        </label>
        <label class="radio-pill ${record.diet.breakfast.eaten === true ? "active" : ""}">
          <input type="radio" name="breakfast" value="ate" ${record.diet.breakfast.eaten === true ? "checked" : ""}> 吃了
        </label>
        <input type="text" class="meal-desc" id="breakfast-desc"
          value="${record.diet.breakfast.description || ""}" placeholder="简单描述">
      </div>
    </div>

    ${["lunch", "dinner"].map(meal => {
      const m = record.diet[meal];
      const label = meal === "lunch" ? "午餐" : "晚餐";
      return `
      <div class="meal-section">
        <div class="meal-title">${label}</div>
        <div class="meal-toggles">
          ${renderToggle("蛋白质", `${meal}-protein`, m?.protein)}
          ${renderToggle("蔬菜", `${meal}-vegetables`, m?.vegetables)}
          ${renderToggle("水果", `${meal}-fruit`, m?.fruit)}
        </div>
        <div class="form-field mt-8">
          <label>碳水</label>
          <select id="${meal}-carbs">
            <option value="">—</option>
            ${["少量","适量","较多"].map(v => `<option ${m?.carbs===v?"selected":""}>${v}</option>`).join("")}
          </select>
        </div>
        ${meal === "dinner" ? `
        <div class="form-field">
          <label>完成时间</label>
          <input type="time" id="dinner-time" value="${m?.finish_time || ""}">
        </div>` : ""}
      </div>`;
    }).join("")}

    <div class="meal-section">
      <div class="meal-title">其他</div>
      <div class="meal-toggles">
        ${renderToggleInvert("含糖饮料", "sugary-drinks", record.diet.sugary_drinks)}
        ${renderToggleInvert("夜宵", "late-night", record.diet.late_night)}
        ${renderToggleInvert("酒精", "alcohol", record.diet.alcohol)}
      </div>
      <div class="form-field mt-8">
        <label>饮水 (L)</label>
        <input type="number" step="0.1" id="water-liters" min="0" max="5"
          value="${record.diet.water_liters || ""}" placeholder="2.0">
      </div>
    </div>

    <button class="btn btn-primary btn-sm mt-8" id="btn-save-diet">保存饮食</button>
  </div>

  <!-- 久坐记录 -->
  <div class="card">
    <div class="card-title">⏰ 久坐管理</div>
    <div class="form-grid">
      <div class="form-field">
        <label>打断次数</label>
        <input type="number" id="sit-breaks" min="0" max="20"
          value="${record.sedentary.breaks || ""}" placeholder="0">
      </div>
      <div class="form-field">
        <label>最长连续久坐 (分钟)</label>
        <input type="number" id="sit-max" min="0" max="480"
          value="${record.sedentary.max_continuous_minutes || ""}" placeholder="0">
      </div>
    </div>
    <button class="btn btn-outline btn-sm mt-8" id="btn-save-sedentary">保存</button>
  </div>
</div>`;
  }

  function renderToggle(label, id, val) {
    return `<label class="toggle-pill ${val === true ? "on" : val === false ? "off" : ""}">
      <input type="checkbox" data-toggle="${id}" ${val === true ? "checked" : ""}> ${label}
    </label>`;
  }

  function renderToggleInvert(label, id, val) {
    // bad thing: checked = did it (bad), so red when checked
    return `<label class="toggle-pill-bad ${val === true ? "on" : val === false ? "off" : ""}">
      <input type="checkbox" data-toggle="${id}" ${val === true ? "checked" : ""}> ${label}
    </label>`;
  }

  function bindExercise() {
    // Set buttons
    document.querySelectorAll(".set-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const exId  = btn.dataset.ex;
        const setIdx = parseInt(btn.dataset.set);
        const exData = state.record.exercise.exercises[exId];
        if (!exData) return;
        exData.sets_done[setIdx] = !exData.sets_done[setIdx];
        await saveRecord(state.record);
        render();
      });
    });

    // RPE buttons
    document.querySelectorAll(".rpe-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const rpe = parseInt(btn.dataset.rpe);
        state.record.exercise.rpe = rpe;
        document.querySelectorAll(".rpe-btn").forEach(b => b.classList.toggle("active", parseInt(b.dataset.rpe) === rpe));
        document.getElementById("rpe-label").textContent = PLAN.rpe_labels[rpe] || "";
      });
    });

    // Pain checkbox
    document.getElementById("pain-check")?.addEventListener("change", e => {
      const has = e.target.checked;
      state.record.exercise.pain.has_pain = has;
      document.getElementById("pain-detail").classList.toggle("hidden", !has);
      if (has) {
        document.getElementById("danger-warn").style.display = "block";
      }
    });

    // Pain location checkboxes
    document.querySelectorAll('[name="pain"]').forEach(cb => {
      cb.addEventListener("change", () => {
        state.record.exercise.pain.locations = Array.from(document.querySelectorAll('[name="pain"]:checked')).map(c => c.value);
      });
    });

    // Meal toggle pills
    document.querySelectorAll("[data-toggle]").forEach(el => {
      el.addEventListener("change", async () => {
        await updateFromForm();
      });
    });

    // Save buttons
    document.getElementById("btn-save-exercise")?.addEventListener("click", async () => {
      state.record.exercise.actual_minutes = parseInt(document.getElementById("ex-actual-min").value) || null;
      await saveRecord(state.record);
      toast("训练数据已保存");
    });

    document.getElementById("btn-save-walk")?.addEventListener("click", async () => {
      state.record.exercise.walking_minutes = parseInt(document.getElementById("walk-min").value) || null;
      await saveRecord(state.record);
      toast("快走记录已保存");
    });

    document.getElementById("btn-save-diet")?.addEventListener("click", async () => {
      await updateFromForm();
      await saveRecord(state.record);
      toast("饮食记录已保存");
    });

    document.getElementById("btn-save-sedentary")?.addEventListener("click", async () => {
      state.record.sedentary.breaks = parseInt(document.getElementById("sit-breaks").value) || null;
      state.record.sedentary.max_continuous_minutes = parseInt(document.getElementById("sit-max").value) || null;
      await saveRecord(state.record);
      toast("久坐记录已保存");
    });
  }

  async function updateFromForm() {
    const r = state.record;
    // breakfast
    const bval = document.querySelector('[name="breakfast"]:checked')?.value;
    r.diet.breakfast.eaten = bval === "ate" ? true : bval === "skip" ? false : null;
    r.diet.breakfast.description = document.getElementById("breakfast-desc")?.value || "";
    // lunch/dinner
    ["lunch", "dinner"].forEach(m => {
      const prot = document.querySelector(`[data-toggle="${m}-protein"]`);
      const veg  = document.querySelector(`[data-toggle="${m}-vegetables"]`);
      const frt  = document.querySelector(`[data-toggle="${m}-fruit"]`);
      const carb = document.getElementById(`${m}-carbs`);
      if (prot) r.diet[m].protein    = prot.checked ? true : null;
      if (veg)  r.diet[m].vegetables = veg.checked ? true : null;
      if (frt)  r.diet[m].fruit      = frt.checked ? true : null;
      if (carb) r.diet[m].carbs      = carb.value || null;
    });
    const dtime = document.getElementById("dinner-time");
    if (dtime) r.diet.dinner.finish_time = dtime.value;
    // other toggles
    [["sugary-drinks", "sugary_drinks"], ["late-night", "late_night"], ["alcohol", "alcohol"]].forEach(([pid, key]) => {
      const el = document.querySelector(`[data-toggle="${pid}"]`);
      if (el) r.diet[key] = el.checked ? true : null;
    });
    const wl = document.getElementById("water-liters");
    if (wl) r.diet.water_liters = parseFloat(wl.value) || null;
  }

  // ── TRENDS 视图 ──────────────────────────────────────────────
  function renderTrends() {
    const pv = state.planVersion;
    return `
<div class="page-trends">
  <div class="trends-header">
    <h2>📈 数据趋势</h2>
    <div class="plan-ver">计划 ${pv?.version || "v1.0"}</div>
  </div>

  <div class="card">
    <canvas id="chart-weight"></canvas>
  </div>
  <div class="card">
    <canvas id="chart-waist"></canvas>
  </div>
  <div class="card">
    <canvas id="chart-sleep"></canvas>
  </div>
  <div class="card">
    <canvas id="chart-exercise"></canvas>
  </div>
  <div class="card">
    <canvas id="chart-symptoms"></canvas>
  </div>
  <div class="card">
    <canvas id="chart-completion"></canvas>
  </div>

  <!-- 7日平均 -->
  <div class="card" id="avgs-card">
    <div class="card-title">📊 7日平均</div>
    <div class="avgs-loading">计算中...</div>
  </div>

  <!-- 计划版本历史 -->
  <div class="card">
    <div class="card-title">📋 计划版本</div>
    <div id="plan-versions-list">加载中...</div>
    <div class="add-ai-section">
      <input type="text" id="ai-advice-input" placeholder="粘贴AI给出的明天建议...">
      <input type="text" id="plan-change-reason" placeholder="调整原因">
      <button class="btn btn-outline btn-sm" id="btn-save-ai">保存AI建议</button>
    </div>
  </div>

  <!-- AI历史 -->
  <div class="card">
    <div class="card-title">🤖 AI建议历史</div>
    <div id="ai-history-list">加载中...</div>
  </div>
</div>`;
  }

  async function bindTrends() {
    const { days, weight, waist, sleep_h, face_oil, scalp_oil,
            hair, dry_mouth, scrotal, exercise, completion } = await getTrendData();

    Charts.drawLineChart(document.getElementById("chart-weight"), {
      days, title: "体重趋势 (kg)", unit: "kg",
      series: [{ values: weight, color: "#3b82f6", label: "体重" }],
    });
    Charts.drawLineChart(document.getElementById("chart-waist"), {
      days, title: "腰围趋势 (cm)", unit: "cm",
      series: [{ values: waist, color: "#8b5cf6", label: "腰围" }],
    });
    Charts.drawLineChart(document.getElementById("chart-sleep"), {
      days, title: "睡眠时长 (h)",
      series: [{ values: sleep_h, color: "#10b981", label: "睡眠" }],
    });
    Charts.drawBarChart(document.getElementById("chart-exercise"), {
      days, values: exercise, title: "运动时长 (min)",
      color: "#f59e0b", height: 160,
    });
    Charts.drawSymptomChart(document.getElementById("chart-symptoms"), {
      days, title: "症状趋势 (1-5分)",
      series: [
        { values: face_oil,  color: "#ef4444", label: "脸出油" },
        { values: scalp_oil, color: "#f59e0b", label: "头皮出油" },
        { values: dry_mouth, color: "#8b5cf6", label: "口干" },
        { values: scrotal,   color: "#3b82f6", label: "干燥管理" },
      ],
    });
    Charts.drawBarChart(document.getElementById("chart-completion"), {
      days, values: completion, title: "每日完成率 (%)",
      color: "#10b981", height: 140,
    });

    // 7日均值
    const avgs = await get7DayAvgs();
    const ac = document.getElementById("avgs-card");
    if (avgs && ac) {
      ac.innerHTML = `<div class="card-title">📊 7日平均</div>
        <div class="avgs-grid">
          <div class="avg-item"><div class="avg-label">体重</div><div class="avg-val">${avgs.weight ?? "—"}kg</div></div>
          <div class="avg-item"><div class="avg-label">腰围</div><div class="avg-val">${avgs.waist ?? "—"}cm</div></div>
          <div class="avg-item"><div class="avg-label">睡眠</div><div class="avg-val">${avgs.sleep ?? "—"}h</div></div>
          <div class="avg-item"><div class="avg-label">脸出油</div><div class="avg-val">${avgs.face_oil ?? "—"}/5</div></div>
          <div class="avg-item"><div class="avg-label">头皮出油</div><div class="avg-val">${avgs.scalp ?? "—"}/5</div></div>
          <div class="avg-item"><div class="avg-label">完成率</div><div class="avg-val">${avgs.completion ?? "—"}%</div></div>
        </div>`;
    }

    // 计划版本
    const pvs = await getAllPlanVersions();
    document.getElementById("plan-versions-list").innerHTML = pvs.length
      ? pvs.reverse().map(pv => `
        <div class="pv-item">
          <div class="pv-ver">${pv.version}</div>
          <div class="pv-date">${pv.created_at} · Day ${pv.applies_from_day}</div>
          <div class="pv-reason">${pv.reason}</div>
          ${pv.changes?.length ? `<ul>${pv.changes.map(c => `<li>${c}</li>`).join("")}</ul>` : ""}
        </div>`).join("")
      : "<div class='muted-text'>暂无版本记录</div>";

    // AI历史
    const aiH = await getAllAIHistory();
    document.getElementById("ai-history-list").innerHTML = aiH.length
      ? aiH.map(h => `
        <div class="ai-history-item">
          <div class="ai-h-meta">Day ${h.day} · ${h.created_at}</div>
          <div class="ai-h-advice">${h.advice}</div>
        </div>`).join("")
      : "<div class='muted-text'>暂无AI建议记录</div>";

    // 保存AI建议
    document.getElementById("btn-save-ai")?.addEventListener("click", async () => {
      const advice = document.getElementById("ai-advice-input").value.trim();
      const reason = document.getElementById("plan-change-reason").value.trim();
      if (!advice) return toast("请粘贴AI建议内容");

      await saveAIHistory({ day: state.day, advice, created_at: new Date().toISOString().slice(0, 16) });

      // 如果有调整原因，创建新计划版本
      if (reason) {
        const prevVer = state.planVersion?.version || "v1.0";
        const vnum = parseFloat(prevVer.replace("v", "")) + 0.1;
        const newVer = "v" + vnum.toFixed(1);
        await savePlanVersion({
          version: newVer,
          created_at: todayStr(),
          applies_from_day: state.day + 1,
          changes: [advice.slice(0, 100)],
          reason,
        });
        state.planVersion = { version: newVer };
      }
      document.getElementById("ai-advice-input").value = "";
      document.getElementById("plan-change-reason").value = "";
      toast("✅ AI建议已保存");
      await bindTrends(); // 刷新
    });
  }

  // ── EXPORT 视图 ──────────────────────────────────────────────
  function renderExport() {
    const { day, record } = state;
    const rate = completionRate(record);

    return `
<div class="page-export">
  <div class="export-header">
    <h2>📤 数据导出</h2>
    <div class="export-meta">Day ${day} · 完成率 ${rate}%</div>
  </div>

  <!-- AI数据包 -->
  <div class="card ai-package-card">
    <div class="card-title">🤖 生成AI分析数据包</div>
    <p class="card-desc">点击生成今日数据摘要，直接复制给ChatGPT / Claude 进行分析。</p>
    <div class="ai-package-preview" id="ai-preview">
      <pre class="ai-text" id="ai-text">点击下方按钮生成...</pre>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btn-gen-ai">🔄 生成数据包</button>
      <button class="btn btn-outline" id="btn-copy-ai" style="display:none">📋 复制到剪贴板</button>
    </div>
    <div class="copy-success hidden" id="copy-success">✅ 已复制！去粘贴给AI吧</div>
  </div>

  <!-- 下载 -->
  <div class="card">
    <div class="card-title">💾 下载数据</div>
    <div class="download-btns">
      <button class="btn btn-outline" id="btn-dl-json">⬇️ 全部数据 JSON</button>
      <button class="btn btn-outline" id="btn-dl-csv">⬇️ 全部数据 CSV</button>
      <button class="btn btn-outline" id="btn-dl-md">⬇️ 今日日记 Markdown</button>
    </div>
  </div>

  <!-- 照片记录提醒 -->
  <div class="card">
    <div class="card-title">📸 照片记录</div>
    <p class="card-desc">请在以下节点拍摄正面、侧面、背面照片（同一位置、时间、自然站姿）：</p>
    <div class="photo-days">
      ${[1, 7, 14, 21, 30].map(d => `
        <div class="photo-day ${state.day === d ? "today" : state.day > d ? "past" : "future"}">
          Day ${d}${d === 1 ? " (现在)" : d === 30 ? " (结束)" : ""}
        </div>`).join("")}
    </div>
    <p class="card-note">⚠️ 照片请自行保存在手机/电脑，本工具不存储照片数据。</p>
  </div>

  <!-- 健康提示 -->
  <div class="card warn-card">
    <div class="card-title">⚠️ 重要提醒</div>
    <ul class="warn-list">
      <li>本系统只记录趋势数据，不做医学诊断</li>
      <li>运动中出现胸痛、晕厥、严重头晕，请立即停止并就医</li>
      <li>如持续掉发、出油明显，建议咨询皮肤科医生</li>
      <li>如体重下降过快（&gt;1%/周），请减少热量缺口</li>
    </ul>
  </div>
</div>`;
  }

  function bindExport() {
    document.getElementById("btn-gen-ai")?.addEventListener("click", async () => {
      const records = state.allRecords;
      const pv = state.planVersion;
      const text = Export.buildAIPackage(state.record, records, pv);
      document.getElementById("ai-text").textContent = text;
      document.getElementById("btn-copy-ai").style.display = "";
    });

    document.getElementById("btn-copy-ai")?.addEventListener("click", async () => {
      const text = document.getElementById("ai-text").textContent;
      try {
        await navigator.clipboard.writeText(text);
        const el = document.getElementById("copy-success");
        el.classList.remove("hidden");
        setTimeout(() => el.classList.add("hidden"), 3000);
      } catch {
        toast("复制失败，请手动选择文字复制");
      }
    });

    document.getElementById("btn-dl-json")?.addEventListener("click", () => Export.downloadJSON());
    document.getElementById("btn-dl-csv")?.addEventListener("click", () => Export.downloadCSV());
    document.getElementById("btn-dl-md")?.addEventListener("click", () => Export.downloadMD(state.record));
  }

  // ── 早晨数据 Modal ─────────────────────────────────────────────
  function showModal(type) {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("hidden");
    if (type === "morning") {
      renderMorningModal();
      document.getElementById("modal-morning").classList.remove("hidden");
    }
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  }

  function renderMorningModal() {
    const r = state.record;
    document.getElementById("morning-content").innerHTML = `
    <h3 class="modal-title">🌅 早晨数据录入</h3>

    <div class="modal-section">
      <div class="section-label">身体测量</div>
      <div class="form-grid">
        <div class="form-field">
          <label>体重 (kg)</label>
          <input type="number" step="0.1" id="m-weight" value="${r.body.weight_kg || ""}" placeholder="${PLAN.baseline.weight_kg}">
        </div>
        <div class="form-field">
          <label>腰围 (cm)</label>
          <input type="number" step="0.5" id="m-waist" value="${r.body.waist_cm || ""}" placeholder="${PLAN.baseline.waist_cm}">
        </div>
      </div>
    </div>

    <div class="modal-section">
      <div class="section-label">睡眠</div>
      <div class="form-grid">
        <div class="form-field">
          <label>入睡时间</label>
          <input type="time" id="m-bed" value="${r.sleep.bed_time || ""}">
        </div>
        <div class="form-field">
          <label>起床时间</label>
          <input type="time" id="m-wake" value="${r.sleep.wake_time || ""}">
        </div>
      </div>
      <div class="sleep-duration" id="sleep-calc">
        ${r.sleep.duration_hours ? `睡眠时长: ${Math.floor(r.sleep.duration_hours)}h${Math.round((r.sleep.duration_hours%1)*60)}m` : ""}
      </div>
      ${renderScaleRow("睡眠质量", "m-sq", r.sleep.quality, PLAN.score_labels.sleep_quality)}
      ${renderScaleRow("起床精神", "m-energy", r.sleep.energy, PLAN.score_labels.energy_level)}
    </div>

    <div class="modal-section">
      <div class="section-label">皮肤/头皮</div>
      ${renderScaleRow("脸部出油", "m-face-oil", r.skin?.face_oiliness, PLAN.score_labels.face_oiliness)}
      <div class="form-field mt-8">
        <label>新增大痘数量</label>
        <div class="pimple-row">
          ${[0,1,2,3,4].map(n => `
            <button class="count-btn ${r.skin?.new_pimples === n ? "active" : ""}" data-pimple="${n}">${n === 4 ? "4+" : n}</button>
          `).join("")}
        </div>
      </div>
      ${renderScaleRow("头皮出油", "m-scalp-oil", r.scalp?.oiliness, PLAN.score_labels.scalp_oiliness)}
      ${renderScaleRow("掉发自评", "m-hair", r.scalp?.hair_shedding, PLAN.score_labels.hair_shedding)}
    </div>

    <div class="modal-section">
      <div class="section-label">其他症状</div>
      ${renderScaleRow("口干", "m-drymouth", r.other?.dry_mouth, PLAN.score_labels.dry_mouth)}
      ${renderScaleRow("干燥管理", "m-scrotal", r.other?.scrotal_moisture, PLAN.score_labels.scrotal_moisture)}
    </div>

    <div class="modal-section">
      <div class="section-label">体态</div>
      <div class="posture-hint">
        📸 体态变化靠照片对比，不靠每日感觉。<br>
        请在 Day 1 / 7 / 14 / 21 / 30 拍正面+侧面照片存档。
      </div>
      <label class="toggle-row mt-8">
        <input type="checkbox" id="m-posture-aware" ${r.posture?.aware ? "checked" : ""}>
        <span>今天注意了体态（走路/坐姿挺直）</span>
      </label>
    </div>

    <button class="btn btn-primary btn-full" id="btn-save-morning">💾 保存</button>`;

    // 睡眠时长自动计算
    const bindSleep = () => {
      const bed  = document.getElementById("m-bed").value;
      const wake = document.getElementById("m-wake").value;
      const h    = calcSleepHours(bed, wake);
      document.getElementById("sleep-calc").textContent = h
        ? `睡眠时长: ${Math.floor(h)}h${Math.round((h%1)*60)}m` : "";
    };
    document.getElementById("m-bed")?.addEventListener("change", bindSleep);
    document.getElementById("m-wake")?.addEventListener("change", bindSleep);

    // 痘痘数量
    document.querySelectorAll(".count-btn[data-pimple]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".count-btn[data-pimple]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // 保存
    document.getElementById("btn-save-morning")?.addEventListener("click", async () => {
      const r = state.record;
      r.body.weight_kg = parseFloat(document.getElementById("m-weight").value) || null;
      r.body.waist_cm  = parseFloat(document.getElementById("m-waist").value) || null;

      const bed  = document.getElementById("m-bed").value;
      const wake = document.getElementById("m-wake").value;
      r.sleep.bed_time       = bed;
      r.sleep.wake_time      = wake;
      r.sleep.duration_hours = calcSleepHours(bed, wake);
      r.sleep.quality        = getScaleVal("m-sq");
      r.sleep.energy         = getScaleVal("m-energy");

      r.skin.face_oiliness = getScaleVal("m-face-oil");
      const pimpleBtn = document.querySelector(".count-btn[data-pimple].active");
      r.skin.new_pimples = pimpleBtn ? parseInt(pimpleBtn.dataset.pimple) : null;
      r.scalp.oiliness      = getScaleVal("m-scalp-oil");
      r.scalp.hair_shedding = getScaleVal("m-hair");

      r.other.dry_mouth        = getScaleVal("m-drymouth");
      r.other.scrotal_moisture = getScaleVal("m-scrotal");

      r.posture.aware = document.getElementById("m-posture-aware")?.checked || false;

      await saveRecord(r);
      toast("✅ 早晨数据已保存");
      closeModal();
      render();
    });
  }

  function renderScaleRow(label, id, currentVal, labels) {
    return `<div class="scale-row">
      <div class="scale-label">${label}</div>
      <div class="scale-btns" id="${id}">
        ${[1,2,3,4,5].map(n => `
          <button class="scale-btn ${currentVal === n ? "active" : ""}" data-scale="${id}" data-val="${n}">
            <div class="scale-n">${n}</div>
            <div class="scale-desc">${labels?.[n] || ""}</div>
          </button>
        `).join("")}
      </div>
    </div>`;
  }

  function getScaleVal(id) {
    const active = document.querySelector(`[data-scale="${id}"].active`);
    return active ? parseInt(active.dataset.val) : null;
  }

  // ── 未完成原因 Modal ──────────────────────────────────────────
  function bindReasonModal() {
    document.querySelectorAll(".reason-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".reason-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.getElementById("btn-confirm-reason")?.addEventListener("click", async () => {
      const modal  = document.getElementById("modal-reason");
      const taskId = modal.dataset.taskId;
      const active = document.querySelector(".reason-btn.active");
      const custom = document.getElementById("reason-custom").value.trim();
      const reason = custom || active?.dataset.reason || "未知原因";

      state.record.tasks[taskId].done   = false;
      state.record.tasks[taskId].reason = reason;
      await saveRecord(state.record);
      closeModal();
      render();
    });

    document.getElementById("btn-cancel-task")?.addEventListener("click", async () => {
      const modal  = document.getElementById("modal-reason");
      const taskId = modal.dataset.taskId;
      // 恢复为未选择状态
      state.record.tasks[taskId].done   = null;
      state.record.tasks[taskId].reason = null;
      await saveRecord(state.record);
      closeModal();
      render();
    });
  }

  // ── 提交今日数据 ──────────────────────────────────────────────
  async function submitDay() {
    const r    = state.record;
    r.submitted    = true;
    r.submitted_at = new Date().toISOString();
    await saveRecord(r);
    state.allRecords = (await getAllRecords()).sort((a, b) => a.date.localeCompare(b.date));
    toast("✅ 今日数据已提交！记得去导出页生成AI数据包");
    render();
  }

  // ── Toast ─────────────────────────────────────────────────────
  function toast(msg, duration = 2500) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(state.toast);
    state.toast = setTimeout(() => el.classList.remove("show"), duration);
  }

  // ── 辅助 ─────────────────────────────────────────────────────
  function groupBy(arr, fn) {
    return arr.reduce((acc, item) => {
      const key = fn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  }

  // ── 全局事件 ─────────────────────────────────────────────────
  function setupGlobalEvents() {
    // overlay 点击关闭
    document.getElementById("modal-overlay")?.addEventListener("click", () => closeModal());
    // 阻止 modal 内部点击冒泡
    document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => e.stopPropagation()));
    // scale 按钮全局委托
    document.body.addEventListener("click", e => {
      const btn = e.target.closest(".scale-btn");
      if (!btn) return;
      const groupId = btn.dataset.scale;
      document.querySelectorAll(`[data-scale="${groupId}"]`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
    // toggle pill / radio pill 视觉状态（事件委托）
    document.body.addEventListener("change", e => {
      const input = e.target;
      const pill = input.closest(".toggle-pill, .toggle-pill-bad");
      if (pill) { pill.classList.toggle("on", input.checked); return; }
      const rp = input.closest(".radio-pill");
      if (rp && input.type === "radio") {
        document.querySelectorAll(`input[name="${input.name}"]`).forEach(r =>
          r.closest(".radio-pill")?.classList.toggle("active", r === input && r.checked)
        );
      }
    });

    // reason modal 绑定
    bindReasonModal();
  }

  return { init, setupGlobalEvents, closeModal, toast };
})();

// ── 启动 ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  App.setupGlobalEvents();
  App.init().catch(err => console.error("App init error:", err));
});
