function momentsAutoCommentsFromControls() {
  const commenters = {};
  document.querySelectorAll(".moment-auto-reader").forEach((input) => {
    commenters[input.dataset.momentAutoReader] = input.getAttribute("aria-pressed") === "true";
  });
  const anyCommenter = Object.values(commenters).some(Boolean);
  return normalizeMomentsAutoComments({
    enabled: document.getElementById("momentAutoCommentMaster")?.getAttribute("aria-pressed") === "true" && anyCommenter,
    commenters: {
      linxu: Boolean(commenters.linxu),
      dengdeng: Boolean(commenters.dengdeng),
      aimas: Boolean(commenters.aimas)
    },
    cooldown_minutes: document.getElementById("momentAutoCooldown")?.value || 120,
    quiet_start: document.getElementById("momentAutoQuietStart")?.value || "23:30",
    quiet_end: document.getElementById("momentAutoQuietEnd")?.value || "09:00"
  });
}

function renderMomentsAutoCommentsPanel() {
  const config = normalizeMomentsAutoComments(apiConfigCache?.moments_auto_comments || defaultApiConfig.moments_auto_comments);
  const master = document.getElementById("momentAutoCommentMaster");
  if (master) {
    master.setAttribute("aria-pressed", config.enabled ? "true" : "false");
    master.setAttribute("aria-expanded", config.enabled ? "true" : "false");
    master.classList.toggle("is-on", config.enabled);
  }
  document.querySelectorAll(".moment-auto-reader").forEach((input) => {
    const reader = input.dataset.momentAutoReader;
    const isOn = Boolean(config.enabled && config.commenters?.[reader]);
    input.setAttribute("aria-pressed", isOn ? "true" : "false");
    input.classList.toggle("is-on", isOn);
  });
  document.getElementById("momentAutoCommentReaders")?.classList.toggle("is-open", config.enabled);
  const cooldown = document.getElementById("momentAutoCooldown");
  if (cooldown && document.activeElement !== cooldown) {
    cooldown.value = String(config.cooldown_minutes);
  }
  const quietStart = document.getElementById("momentAutoQuietStart");
  if (quietStart && document.activeElement !== quietStart) {
    quietStart.value = config.quiet_start;
  }
  const quietEnd = document.getElementById("momentAutoQuietEnd");
  if (quietEnd && document.activeElement !== quietEnd) {
    quietEnd.value = config.quiet_end;
  }
  const openCommenters = Object.entries(config.commenters || {})
    .filter(([, enabled]) => enabled)
    .map(([reader]) => momentAutoReaderLabels[reader] || reader);
  const status = document.getElementById("momentAutoCommentStatus");
  if (status) {
    status.textContent = config.enabled
      ? `auto reply 设置：${openCommenters.join("、")}可自动回应；冷却 ${config.cooldown_minutes} 分钟；安静时段 ${config.quiet_start}-${config.quiet_end}。`
      : "auto reply：关闭，只保留手动点名回应。";
  }
}

async function saveMomentsAutoCommentsConfig() {
  const status = document.getElementById("momentAutoCommentStatus");
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  apiConfigCache.moments_auto_comments = momentsAutoCommentsFromControls();
  renderMomentsAutoCommentsPanel();
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：自动评论设置暂时不能写入 D 盘。";
    return;
  }
  if (status) status.textContent = "正在保存自动评论设置...";
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    renderApiConfig(selectedProviderId);
    if (status) status.textContent = `开关已保存。${status.textContent}`;
  } catch (error) {
    if (status) status.textContent = `自动评论设置保存失败：${error.message}`;
  }
}

function renderMomentsAutoPreview(data = {}) {
  const box = document.getElementById("momentAutoPreview");
  if (!box) {
    return;
  }
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const blocked = Array.isArray(data.blocked) ? data.blocked : [];
  const lines = [];
  if (data.summary) {
    lines.push(`<p><strong>${escapeHtml(data.summary)}</strong></p>`);
  }
  candidates.forEach((item) => {
    lines.push(`
      <article class="moment-auto-candidate">
        <p><strong>${escapeHtml(item.commenter_label || item.commenter || "")}</strong> → ${escapeHtml(item.post_author_label || "某条圈圈")}：${escapeHtml(item.post_text || "一张图片")}</p>
        <button type="button" data-moment-auto-run="${escapeHtml(item.moment_id || "")}" data-moment-auto-commenter="${escapeHtml(item.commenter || "")}">确认回应</button>
      </article>
    `);
  });
  blocked.forEach((item) => {
    lines.push(`<p>${escapeHtml(item.commenter_label || item.commenter || "")}：${escapeHtml(item.reason || "暂缓")}</p>`);
  });
  box.innerHTML = lines.join("") || `<p>暂时没有候选。</p>`;
  box.hidden = false;
}

async function runMomentsAutoCandidate(momentId, commenter) {
  const safeCommenter = ["linxu", "dengdeng", "aimas"].includes(commenter) ? commenter : "";
  if (!momentId || !safeCommenter) {
    return;
  }
  const label = momentAutoReaderLabels[safeCommenter] || safeCommenter;
  const ok = await openAppDialog({
    kicker: "AUTO REPLY",
    title: `确认让${label}回应这条圈圈？`,
    message: "确认后会调用对应模型生成评论，并写入 moments.jsonl。现在仍然不是后台自动发送。",
    cancelText: "先不发",
    confirmText: "确认回应"
  });
  if (!ok) {
    return;
  }
  const status = document.getElementById("momentAutoCommentStatus");
  if (status) status.textContent = `正在请${label}回应候选圈圈...`;
  try {
    const data = await appApi.runMomentAction({ id: momentId, action: "auto_comment", author: safeCommenter });
    renderMoments(mergeMomentEntries(readBrowserMoments(), data.entries || []));
    if (status) status.textContent = `${label}已回应；候选已刷新。`;
    await previewMomentsAutoComments();
  } catch (error) {
    if (status) status.textContent = `候选回应失败：${error.message}`;
  }
}

async function previewMomentsAutoComments() {
  const status = document.getElementById("momentAutoCommentStatus");
  const box = document.getElementById("momentAutoPreview");
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：不能查看自动评论候选。";
    if (box) box.hidden = true;
    return;
  }
  if (status) status.textContent = "正在读取自动评论候选...";
  try {
    const data = await appApi.previewMomentsAutoComments();
    renderMomentsAutoPreview(data);
    if (status) status.textContent = data.summary || "自动评论候选已读取。";
  } catch (error) {
    if (status) status.textContent = `自动评论候选读取失败：${error.message}`;
    if (box) box.hidden = true;
  }
}
