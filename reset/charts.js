// Canvas-based lightweight charts for 30-day reset
const Charts = (() => {
  const COLORS = {
    primary:  "#10b981",
    blue:     "#3b82f6",
    purple:   "#8b5cf6",
    amber:    "#f59e0b",
    red:      "#ef4444",
    muted:    "#9ca3af",
    grid:     "#f3f4f6",
    text:     "#6b7280",
  };

  function dpr() { return window.devicePixelRatio || 1; }

  function setup(canvas, w, h) {
    const r = dpr();
    canvas.width  = w * r;
    canvas.height = h * r;
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(r, r);
    return ctx;
  }

  // Remove nulls but keep index mapping
  function compactSeries(days, values) {
    const pts = [];
    days.forEach((d, i) => {
      if (values[i] != null) pts.push({ d, v: values[i] });
    });
    return pts;
  }

  function cardWidth(canvas) {
    // parentElement is the .card; subtract its horizontal padding (16px each side)
    return Math.max((canvas.parentElement?.clientWidth || 370) - 32, 260);
  }

  function drawLineChart(canvas, { days, series, title, yMin, yMax, unit = "", height = 180 }) {
    const W = cardWidth(canvas);
    const H = height;
    const PAD = { top: 28, right: 16, bottom: 32, left: 42 };
    const ctx = setup(canvas, W, H);

    ctx.clearRect(0, 0, W, H);

    // title
    ctx.fillStyle = "#374151";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(title, PAD.left, 18);

    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // auto y range
    let allVals = series.flatMap(s => s.values).filter(v => v != null);
    if (!allVals.length) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("暂无数据", W / 2, H / 2);
      ctx.textAlign = "left";
      return;
    }
    const lo = yMin != null ? yMin : Math.min(...allVals);
    const hi = yMax != null ? yMax : Math.max(...allVals);
    const span = hi - lo || 1;
    const padV = span * 0.1;
    const yLo = lo - padV;
    const yHi = hi + padV;

    function xPos(d) { return PAD.left + (d - 1) / (PLAN.TOTAL_DAYS - 1) * chartW; }
    function yPos(v) { return PAD.top + (1 - (v - yLo) / (yHi - yLo)) * chartH; }

    // grid lines (3 horizontal)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 1;
    [0, 0.5, 1].forEach(t => {
      const y = PAD.top + t * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      const val = (yHi - (yHi - yLo) * t).toFixed(1);
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(val, PAD.left - 4, y + 3);
    });
    ctx.textAlign = "left";

    // x axis labels (Day 1, 7, 14, 21, 28, 30)
    [1, 7, 14, 21, 28, 30].forEach(d => {
      if (d > PLAN.TOTAL_DAYS) return;
      const x = xPos(d);
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("D" + d, x, H - 6);
    });
    ctx.textAlign = "left";

    // phase background bands
    PLAN.phases.forEach(p => {
      ctx.fillStyle = p.color + "10";
      ctx.fillRect(xPos(p.days[0]), PAD.top, xPos(p.days[1]) - xPos(p.days[0]), chartH);
    });

    // series
    series.forEach(({ values, color, label }) => {
      const pts = compactSeries(days, values);
      if (pts.length < 1) return;

      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = "round";
      ctx.beginPath();
      pts.forEach(({ d, v }, i) => {
        const x = xPos(d);
        const y = yPos(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // dots
      pts.forEach(({ d, v }) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xPos(d), yPos(v), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // legend
    if (series.length > 1) {
      let lx = PAD.left;
      series.forEach(({ color, label }) => {
        ctx.fillStyle = color;
        ctx.fillRect(lx, 5, 10, 10);
        ctx.fillStyle = "#374151";
        ctx.font = "10px system-ui";
        ctx.fillText(label, lx + 14, 14);
        lx += ctx.measureText(label).width + 30;
      });
    }
  }

  function drawBarChart(canvas, { days, values, color = COLORS.primary, title, unit = "", height = 160 }) {
    const W   = cardWidth(canvas);
    const H   = height;
    const PAD = { top: 28, right: 16, bottom: 32, left: 36 };
    const ctx = setup(canvas, W, H);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#374151";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(title, PAD.left, 18);

    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const pts = compactSeries(days, values);
    if (!pts.length) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("暂无数据", W / 2, H / 2);
      ctx.textAlign = "left";
      return;
    }

    const hi = Math.max(...pts.map(p => p.v));
    const yHi = hi * 1.1 || 1;

    function xPos(d) { return PAD.left + (d - 1) / PLAN.TOTAL_DAYS * chartW; }
    const barW = chartW / PLAN.TOTAL_DAYS * 0.7;

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    [0, 0.5, 1].forEach(t => {
      const y = PAD.top + t * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(yHi * (1 - t)), PAD.left - 4, y + 3);
    });
    ctx.textAlign = "left";

    // x labels
    [1, 7, 14, 21, 28, 30].forEach(d => {
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("D" + d, xPos(d) + barW / 2, H - 6);
    });
    ctx.textAlign = "left";

    pts.forEach(({ d, v }) => {
      const barH = (v / yHi) * chartH;
      const x = xPos(d);
      const y = PAD.top + chartH - barH;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, barH);
    });
  }

  // 5-scale symptom trend
  function drawSymptomChart(canvas, { days, series, title, height = 160 }) {
    drawLineChart(canvas, { days, series, title, yMin: 1, yMax: 5, height });
  }

  return { drawLineChart, drawBarChart, drawSymptomChart };
})();
