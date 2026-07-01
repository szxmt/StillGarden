function clearChatSearch() {
  chatSearchRunId += 1;
  if (chatSearchTimer) {
    window.clearTimeout(chatSearchTimer);
    chatSearchTimer = null;
  }
  document.querySelectorAll("#chatThread .bubble.search-hit").forEach((bubble) => {
    bubble.classList.remove("search-hit");
  });
  const results = document.getElementById("chatSearchResults");
  if (results) {
    results.innerHTML = "";
  }
  const status = document.getElementById("chatSearchStatus");
  if (status) {
    status.textContent = "搜索会查当前房间的完整本地 session，点结果可以跳回对应消息。";
  }
}

function runChatSearch() {
  const input = document.getElementById("chatSearchInput");
  const query = input?.value?.trim() || "";
  document.querySelectorAll("#chatThread .bubble.search-hit").forEach((bubble) => {
    bubble.classList.remove("search-hit");
  });
  const results = document.getElementById("chatSearchResults");
  if (results) {
    results.innerHTML = "";
  }
  if (!query) {
    const status = document.getElementById("chatSearchStatus");
    if (status) {
      status.textContent = "搜索会查当前房间的完整本地 session，点结果可以跳回对应消息。";
    }
    return;
  }
  const hits = [...document.querySelectorAll("#chatThread .bubble")]
    .filter((bubble) => (bubble.querySelector("p")?.textContent || "").includes(query));
  hits.forEach((bubble) => bubble.classList.add("search-hit"));
  const status = document.getElementById("chatSearchStatus");
  if (status) {
    status.textContent = serviceOnline
      ? "正在查这个房间的完整本地记录..."
      : (hits.length ? `当前屏幕找到 ${hits.length} 条；本地服务未连接，暂时不能查完整记录。` : "当前屏幕没找到；本地服务未连接。");
  }
  if (chatSearchTimer) {
    window.clearTimeout(chatSearchTimer);
  }
  const room = selectedChatRoom;
  const runId = ++chatSearchRunId;
  chatSearchTimer = window.setTimeout(() => performFullChatSearch(room, query, runId, hits.length), 240);
}

function chatSearchSnippet(text, query) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return "这条记录没有正文。";
  }
  const lowerText = cleanText.toLowerCase();
  const lowerQuery = String(query || "").toLowerCase();
  const index = lowerQuery ? lowerText.indexOf(lowerQuery) : -1;
  const start = Math.max(0, index - 18);
  const end = Math.min(cleanText.length, (index >= 0 ? index + lowerQuery.length : 0) + 42);
  const safeEnd = Math.min(cleanText.length, Math.max(end, start + 68));
  const snippet = cleanText.slice(start, safeEnd);
  return `${start > 0 ? "..." : ""}${snippet}${safeEnd < cleanText.length ? "..." : ""}`;
}

function renderChatSearchResults(entries, query) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return `<p class="chat-search-empty">完整记录里也没有找到。</p>`;
  }
  return list.map((entry) => {
    const room = chatProfiles[entry.room] ? entry.room : selectedChatRoom;
    const profile = chatProfiles[room] || chatProfiles[selectedChatRoom] || chatProfiles.linxu;
    const isAssistant = entry.role === "assistant";
    const author = isAssistant ? profile.name : "你";
    const disabled = entry.client_id ? "" : " disabled";
    return `
      <button class="chat-search-result" type="button" data-chat-search-room="${escapeHtml(room)}" data-chat-search-jump="${escapeHtml(entry.client_id || "")}"${disabled}>
        <span>${escapeHtml(author)} · ${escapeHtml(formatSessionTime(entry.timestamp))}</span>
        <strong>${escapeHtml(chatSearchSnippet(entry.text, query))}</strong>
      </button>
    `;
  }).join("");
}

async function performFullChatSearch(room, query, runId, currentHitCount = 0) {
  if (!serviceOnline) {
    return;
  }
  const status = document.getElementById("chatSearchStatus");
  const results = document.getElementById("chatSearchResults");
  try {
    const data = await fetchSessionLog(room, 60, query);
    if (runId !== chatSearchRunId) {
      return;
    }
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (results) {
      results.innerHTML = renderChatSearchResults(entries, query);
    }
    if (status) {
      status.textContent = entries.length
        ? `完整记录找到 ${entries.length} 条；点一条会打开聊天并跳到那里。`
        : (currentHitCount ? `当前屏幕有 ${currentHitCount} 条，但 D 盘完整记录里暂时没命中。` : "完整记录里没有找到。");
    }
  } catch (error) {
    if (runId !== chatSearchRunId) {
      return;
    }
    if (status) {
      status.textContent = "完整记录搜索失败：本地服务没有接住这次请求。";
    }
  }
}

function handleChatSearchResultClick(event) {
  const button = event.target.closest("[data-chat-search-jump]");
  if (!button) {
    return;
  }
  const draftId = button.dataset.chatSearchJump || "";
  const room = button.dataset.chatSearchRoom || selectedChatRoom;
  if (!draftId) {
    showChatToast("这条旧记录没有跳转编号，只能先留在搜索结果里看。", "warning", 2400);
    return;
  }
  closeChatInfoSheet();
  openChatAtRecord(room, draftId);
}
