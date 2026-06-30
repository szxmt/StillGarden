function renderArchiveResults(data) {
  const results = data.results || [];
  if (!results.length) {
    return `
      <p class="archive-empty">${escapeHtml(data.message || "没有命中。Aimas 只会搜索自己确认过的新记忆，不会搜索旧私有记忆。")}</p>
    `;
  }
  const countLine =
    typeof data.raw_match_count === "number" && typeof data.collapsed_match_count === "number"
      ? `原始命中 ${formatNumber(data.raw_match_count)} 条，折叠后 ${formatNumber(data.collapsed_match_count)} 组。`
      : "";
  return `
    <div class="archive-result-head">
      <strong>${escapeHtml(data.display || "Archive")}</strong>
      <span>${escapeHtml(countLine || data.message || "检索结果来自索引摘要。")}</span>
    </div>
    ${results
      .map(
        (item) => `
          <article class="archive-result-card">
            <span>${escapeHtml(resultMeta(item))}</span>
            <strong>${escapeHtml(item.title || item.reference || "未命名片段")}</strong>
            ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
            ${
              item.duplicate_count
                ? `<small class="duplicate-pill">已折叠 ${formatNumber(item.duplicate_count)} 条相似来源</small>`
                : ""
            }
            <em>引用：${escapeHtml(item.reference || "无")} · 分数：${escapeHtml(item.score ?? "-")}</em>
          </article>
        `
      )
      .join("")}
  `;
}

function renderConfirmedMemory(entries = []) {
  if (!entries.length) {
    return `<p class="archive-empty">还没有确认入库的记忆。草稿不会自动进入这里。</p>`;
  }
  return entries
    .map((entry) => {
      const label = entry.room_label || roomLabels[entry.room] || entry.room || "小窝";
      const date = entry.effective_date || entry.timestamp || "";
      const category = Array.isArray(entry.categories) ? entry.categories[0] : entry.categories || "confirmed-memory";
      const summary = String(entry.summary || entry.local_preview || "").slice(0, 180);
      const relation = entry.relation_object ? ` · ${entry.relation_object}` : "";
      const scope = entry.readable_scope ? ` · ${memoryScopeLabels[entry.readable_scope] || entry.readable_scope}` : "";
      const importance = entry.importance ? ` · ${memoryImportanceLabels[entry.importance] || `重要度 ${entry.importance}`}` : "";
      const sensitive = entry.sensitive || entry.flags?.includes("sensitive") ? " · 敏感" : "";
      return `
        <article class="confirmed-memory-card">
          <span>${escapeHtml(label)} · ${escapeHtml(date)} · ${escapeHtml(category)}${escapeHtml(relation)}${escapeHtml(scope)}${escapeHtml(importance)}${escapeHtml(sensitive)}</span>
          <strong>${escapeHtml(entry.title || "确认记忆")}</strong>
          <p>${escapeHtml(summary)}${summary.length >= 180 ? "..." : ""}</p>
        </article>
      `;
    })
    .join("");
}

async function loadConfirmedMemory() {
  const list = document.getElementById("confirmedMemoryList");
  if (!list) {
    return;
  }
  if (!serviceOnline) {
    list.innerHTML = `<p class="archive-empty">静态预览模式：确认记忆需要用 start-stillgarden.bat 打开后读取。</p>`;
    return;
  }
  try {
    const data = await appApi.getConfirmedMemory({ limit: 8 });
    list.innerHTML = renderConfirmedMemory(data.entries || []);
  } catch (error) {
    list.innerHTML = `<p class="archive-empty">确认记忆读取失败：${escapeHtml(error.message)}</p>`;
  }
}

function memoryStatus(text) {
  const status = document.getElementById("memoryConfirmStatus");
  if (status) {
    status.textContent = text;
  }
}

async function generateDailyMemoryDraft() {
  const room = document.getElementById("memoryRoom")?.value || "linxu";
  const button = document.getElementById("memoryDailyButton");
  if (!serviceOnline) {
    memoryStatus("未连接本地服务：不能从 D 盘 session 生成日摘要。");
    return;
  }
  if (button) button.disabled = true;
  memoryStatus("正在把今天的聊天压成一张草稿纸...");
  try {
    const data = await appApi.createDailyMemorySummary({ room });
    const record = data.record || {};
    currentMemoryCandidateId = record.id || "";
    const title = document.getElementById("memoryTitle");
    const text = document.getElementById("memoryText");
    const category = document.getElementById("memoryCategory");
    const relation = document.getElementById("memoryRelation");
    if (title) title.value = record.title || "";
    if (text) text.value = record.text || "";
    if (category) category.value = "daily-note";
    if (relation && !relation.value.trim()) relation.value = record.room_label || roomLabels[room] || "";
    memoryStatus(`已生成草稿：${data.relative_path}。确认前不会进入长期记忆。`);
  } catch (error) {
    memoryStatus(`日摘要草稿生成失败：${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function confirmMemoryEntry() {
  const room = document.getElementById("memoryRoom")?.value || "linxu";
  const category = document.getElementById("memoryCategory")?.value?.trim() || "memory-card";
  const title = document.getElementById("memoryTitle")?.value?.trim() || "";
  const text = document.getElementById("memoryText")?.value?.trim() || "";
  const relationObject = document.getElementById("memoryRelation")?.value?.trim() || "";
  const importance = Number(document.getElementById("memoryImportance")?.value || 3);
  const readableScope = document.getElementById("memoryScope")?.value || "room";
  const sensitive = document.getElementById("memorySensitiveFlag")?.checked || false;
  const button = document.getElementById("memoryConfirmButton");
  if (!serviceOnline) {
    memoryStatus("未连接本地服务：不能写入 D 盘确认记忆。");
    return;
  }
  if (!text) {
    memoryStatus("内容还是空的，先写一点再确认。");
    return;
  }
  const ok = await openAppDialog({
    kicker: "MEMORY CARD",
    title: "确认留下这一件事？",
    message:
      `标题：${title || "未命名记忆"}\n` +
      `关系对象：${relationObject || "未填写"}\n` +
      `重要度：${memoryImportanceLabels[importance] || importance}\n` +
      `可读范围：${memoryScopeLabels[readableScope] || readableScope}\n` +
      `敏感标记：${sensitive ? "是" : "否"}\n\n` +
      "确认后会写入 sessions/prototype/confirmed-memory.jsonl。",
    cancelText: "再看看",
    confirmText: "确认留下"
  });
  if (!ok) {
    memoryStatus("已停在提交前，你可以继续改这张记忆卡。");
    return;
  }
  if (button) button.disabled = true;
  memoryStatus("正在确认入库...");
  try {
    const data = await appApi.confirmMemory({
      room,
      category,
      title,
      text,
      relation_object: relationObject,
      importance,
      readable_scope: readableScope,
      sensitive,
      candidate_id: currentMemoryCandidateId
    });
    currentMemoryCandidateId = "";
    memoryStatus(`已确认入库：${data.relative_path}。现在可以用 Archive 搜这条记忆。`);
    await loadConfirmedMemory();
  } catch (error) {
    memoryStatus(`确认失败：${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function refreshMemoryIndex() {
  const button = document.getElementById("memoryRefreshButton");
  if (!serviceOnline) {
    memoryStatus("未连接本地服务：不能刷新索引。");
    return;
  }
  if (button) button.disabled = true;
  memoryStatus("正在刷新索引状态...");
  try {
    const data = await appApi.refreshMemoryIndex();
    memoryStatus(`${data.message} 当前确认记忆 ${formatNumber(data.confirmed_count || 0)} 条。`);
    await loadConfirmedMemory();
  } catch (error) {
    memoryStatus(`刷新失败：${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}
function initArchiveController() {
  document.getElementById("archiveSearchButton")?.addEventListener("click", async () => {
    const room = document.getElementById("archiveRoom")?.value || "linxu";
    const query = document.getElementById("archiveQuery")?.value?.trim() || "人格";
    const includeSensitive = document.getElementById("archiveSensitive")?.checked || false;
    const output = document.getElementById("archiveResults");
    const button = document.getElementById("archiveSearchButton");
    button.disabled = true;
    output.textContent = "正在轻轻翻抽屉...";
    try {
      const data = await appApi.searchArchive({ room, query, includeSensitive });
      output.innerHTML = renderArchiveResults(data);
    } catch (error) {
      output.innerHTML = `
        <p class="archive-empty">
          现在是静态页面模式，还没有启动本地小窝服务。双击 start-stillgarden.bat 后，这个抽屉会调用记忆搜索工具。
        </p>
      `;
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("archiveRoom")?.addEventListener("change", (event) => {
    const memoryRoom = document.getElementById("memoryRoom");
    if (memoryRoom) {
      memoryRoom.value = event.target.value;
    }
  });

  document.getElementById("memoryRoom")?.addEventListener("change", () => {
    currentMemoryCandidateId = "";
  });

  document.getElementById("memoryTitle")?.addEventListener("input", () => {
    currentMemoryCandidateId = "";
    const category = document.getElementById("memoryCategory");
    if (category) category.value = "memory-card";
  });

  document.getElementById("memoryText")?.addEventListener("input", () => {
    currentMemoryCandidateId = "";
    const category = document.getElementById("memoryCategory");
    if (category) category.value = "memory-card";
  });

  ["memoryRelation", "memoryImportance", "memoryScope", "memorySensitiveFlag"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      currentMemoryCandidateId = "";
      const category = document.getElementById("memoryCategory");
      if (category) category.value = "memory-card";
    });
    document.getElementById(id)?.addEventListener("change", () => {
      currentMemoryCandidateId = "";
      const category = document.getElementById("memoryCategory");
      if (category) category.value = "memory-card";
    });
  });
}

