function timelineMatchesFilter(entry = {}) {
  return timelineMatchesPerson(entry, currentTimelinePerson, { meLabel: momentAuthors.me })
    && timelineMatchesSource(entry, currentTimelineSource);
}

function renderTimelineEvents() {
  const listNode = document.getElementById("timelineEventList");
  const statusNode = document.getElementById("timelineStatus");
  const pageLabel = document.getElementById("timelinePageLabel");
  const prevButton = document.getElementById("timelinePrevButton");
  const nextButton = document.getElementById("timelineNextButton");
  if (!listNode) {
    return;
  }
  const filteredEntries = timelineEntries.filter((entry) => timelineMatchesFilter(entry));
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / timelinePageSize));
  timelinePage = Math.min(Math.max(1, timelinePage), totalPages);
  const start = (timelinePage - 1) * timelinePageSize;
  const entries = filteredEntries.slice(start, start + timelinePageSize);
  if (statusNode) {
    statusNode.textContent = timelineEntries.length
      ? `已读取 ${timelineEntries.length} 条，${timelineFilterLabel(currentTimelinePerson, currentTimelineSource)}：${filteredEntries.length} 条。`
      : "时间线会只读聚合聊天、圈圈、评论和确认记忆。";
  }
  if (pageLabel) {
    pageLabel.textContent = `第 ${timelinePage} / ${totalPages} 页`;
  }
  if (prevButton) {
    prevButton.disabled = timelinePage <= 1;
  }
  if (nextButton) {
    nextButton.disabled = timelinePage >= totalPages;
  }
  if (!entries.length) {
    listNode.innerHTML = `<p class="timeline-empty">${timelineEntries.length ? "这个筛选下暂时没有事件。" : "还没有读到时间线事件。"}</p>`;
    return;
  }
  listNode.innerHTML = entries.map((entry) => {
    const actor = entry.actor_label || momentDisplayName(entry.actor) || "系统";
    const label = timelineTypeLabel(entry.type);
    const room = entry.room && chatProfiles[entry.room] ? chatProfiles[entry.room].name : "";
    const source = [label, room].filter(Boolean).join(" · ");
    const text = String(entry.text || "").trim() || "这条事件没有正文。";
    const sourcePath = entry.source_file || entry.source || "";
    return `
      <details class="timeline-event" title="${escapeHtml(sourcePath)}">
        <summary>
          <header>
            <span>${escapeHtml(actor)} · ${escapeHtml(formatSessionTime(entry.timestamp))}</span>
            <span>${escapeHtml(label)}</span>
          </header>
          <p>${escapeHtml(text)}</p>
          <span class="timeline-event-meta">${escapeHtml(source || label)}</span>
        </summary>
        <div class="timeline-event-detail">
          <p>${escapeHtml(text)}</p>
          <span>${escapeHtml(sourcePath)}</span>
        </div>
      </details>
    `;
  }).join("");
  listNode.scrollTop = 0;
}

async function loadTimeline() {
  const statusNode = document.getElementById("timelineStatus");
  const listNode = document.getElementById("timelineEventList");
  if (!listNode) {
    return;
  }
  if (!serviceOnline) {
    if (statusNode) statusNode.textContent = "未连接本地服务：时间线暂时不能读取。";
    listNode.innerHTML = `<p class="timeline-empty">请用 start-stillgarden.bat 打开本地服务。</p>`;
    return;
  }
  if (statusNode) statusNode.textContent = "正在读取本地时间线...";
  try {
    const data = await appApi.getTimeline({ limit: 160 });
    timelineEntries = Array.isArray(data.entries) ? data.entries : [];
    timelinePage = 1;
    renderTimelineEvents();
  } catch (error) {
    if (statusNode) statusNode.textContent = `时间线读取失败：${error.message}`;
    listNode.innerHTML = `<p class="timeline-empty">这次没有读到时间线。</p>`;
  }
}
function initTimelineController() {
  document.getElementById("timelineRefreshButton")?.addEventListener("click", loadTimeline);
  document.getElementById("timelinePersonSelect")?.addEventListener("change", (event) => {
    currentTimelinePerson = event.target.value || "all";
    timelinePage = 1;
    renderTimelineEvents();
  });
  document.getElementById("timelineSourceSelect")?.addEventListener("change", (event) => {
    currentTimelineSource = event.target.value || "all";
    timelinePage = 1;
    renderTimelineEvents();
  });
  document.getElementById("timelinePrevButton")?.addEventListener("click", () => {
    timelinePage = Math.max(1, timelinePage - 1);
    renderTimelineEvents();
  });
  document.getElementById("timelineNextButton")?.addEventListener("click", () => {
    timelinePage += 1;
    renderTimelineEvents();
  });
}

