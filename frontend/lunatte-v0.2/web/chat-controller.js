function browserDraftKey(room) {
  return browserStore.browserDraftKey(room);
}

function readBrowserDrafts(room) {
  return browserStore.readBrowserDrafts(room);
}

function chatPrefsKey() {
  return browserStore.chatPrefsKey();
}

function readChatPrefs() {
  return browserStore.readChatPrefs();
}

function writeChatPrefs(prefs) {
  if (!browserStore.writeChatPrefs(prefs)) {
    showChatToast("这个浏览器没有存下聊天设置。", "warning", 2200);
  }
}

function chatPrefsFor(room) {
  return browserStore.chatPrefsFor(room);
}

function updateChatPrefs(room, patch) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  if (!browserStore.updateChatPrefs(safeRoom, patch)) {
    showChatToast("这个浏览器没有存下聊天设置。", "warning", 2200);
  }
  applyChatPreferences(safeRoom);
  renderChatInfoSheet(safeRoom);
  updateConversationPreview(safeRoom);
}

function applyChatPreferences(room = selectedChatRoom) {
  const prefs = chatPrefsFor(room);
  const background = profileAssetFor(room).chat_background || prefs.background;
  const thread = document.getElementById("chatThread");
  if (!thread) {
    return;
  }
  if (background) {
    thread.style.backgroundImage =
      `linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 247, 250, 0.62)), url("${background}")`;
    thread.style.backgroundSize = "cover";
    thread.style.backgroundPosition = "center";
  } else {
    thread.style.backgroundImage = "";
    thread.style.backgroundSize = "";
    thread.style.backgroundPosition = "";
  }
}

function writeBrowserDraft(room, text) {
  const record = createDraftRecord(room, text);
  return writeBrowserEntry(room, record);
}

function writeBrowserEntry(room, record) {
  return browserStore.writeBrowserEntry(room, record);
}

function updateConversationPreview(room, entries = readBrowserDrafts(room)) {
  const preview = document.querySelector(`[data-chat-preview="${room}"]`);
  const time = document.querySelector(`[data-chat-time="${room}"]`);
  const item = document.querySelector(`[data-chat-room="${room}"]`);
  const profile = chatProfiles[room] || chatProfiles.linxu;
  const latest = [...entries].filter(Boolean).sort((left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0)).at(-1);
  if (!preview || !time) {
    return;
  }
  preview.textContent = latest
    ? `${latest.role === "assistant" ? `${profile.name}：` : ""}${latest.text}`
    : profile.preview || "独立 session";
  time.textContent = latest ? formatConversationTime(latest.timestamp) : "--:--";
  if (item) {
    item.dataset.chatGroup = profile.group || "single";
    item.dataset.chatOrder = String(profile.order || 99);
    item.dataset.latestTimestamp = latest?.timestamp || "";
    item.dataset.chatPinned = chatPrefsFor(room).pinned ? "true" : "false";
    item.classList.toggle("is-pinned", Boolean(chatPrefsFor(room).pinned));
  }
  sortConversationList();
}

function latestTimeValue(item) {
  const timestamp = item.dataset.latestTimestamp;
  if (!timestamp) {
    return 0;
  }
  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortConversationList() {
  const list = document.getElementById("conversationList");
  if (!list) {
    return;
  }
  const items = [...list.querySelectorAll(".conversation-item")];
  const groupRank = { single: 1, group: 2 };
  items
    .sort((left, right) => {
      const leftPinned = left.dataset.chatPinned === "true";
      const rightPinned = right.dataset.chatPinned === "true";
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      const leftGroup = groupRank[left.dataset.chatGroup || "single"] || 9;
      const rightGroup = groupRank[right.dataset.chatGroup || "single"] || 9;
      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }
      const leftLatest = latestTimeValue(left);
      const rightLatest = latestTimeValue(right);
      if (leftLatest !== rightLatest) {
        return rightLatest - leftLatest;
      }
      return Number(left.dataset.chatOrder || 99) - Number(right.dataset.chatOrder || 99);
    })
    .forEach((item) => list.appendChild(item));
}

async function refreshConversationPreview(room) {
  const browserEntries = readBrowserDrafts(room);
  updateConversationPreview(room, browserEntries);
  try {
    const data = await fetchSessionLog(room);
    updateConversationPreview(room, mergeDraftEntries(browserEntries, data.entries));
  } catch (error) {
    // Static mode still has browser drafts for the list preview.
  }
}

function refreshAllConversationPreviews() {
  Object.keys(chatProfiles).forEach((room) => {
    refreshConversationPreview(room);
  });
}

function renderSavedDrafts(entries) {
  if (!entries?.length) {
    return "";
  }
  return `
    <div class="bubble system">
      <span>本地记录</span>
      <p>下面是这个房间最近留下的消息。它们还没有进入 Archive，也不会跨房间出现。</p>
    </div>
    ${entries
      .map((entry) => renderDraftBubble(entry))
      .join("")}
  `;
}

function renderDraftBubble(entry) {
  const profile = chatProfiles[entry.room] || chatProfiles[selectedChatRoom] || chatProfiles.linxu;
  const isAssistant = entry.role === "assistant";
  const room = chatProfiles[entry.room] ? entry.room : selectedChatRoom;
  const author = isAssistant ? room : "me";
  return `
    <div class="bubble ${isAssistant ? "theirs" : "mine"} saved-draft" data-draft-id="${escapeHtml(entry.client_id || "")}" data-bubble-author="${escapeHtml(author)}">
      <span>${escapeHtml(isAssistant ? profile.name : "你")} · ${escapeHtml(formatSessionTime(entry.timestamp))}</span>
      <p>${escapeHtml(entry.text)}</p>
      <div class="bubble-actions">
        <button type="button" data-bubble-moment>发圈圈</button>
      </div>
    </div>
  `;
}

async function openChatAtRecord(room, draftId) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  await openChatRoom(safeRoom);
  if (draftId && serviceOnline) {
    try {
      const data = await fetchSessionLog(safeRoom, 500);
      const slot = document.getElementById("savedDraftsSlot");
      if (slot) {
        slot.innerHTML = renderSavedDrafts(mergeDraftEntriesWithLimit(500, readBrowserDrafts(safeRoom), data.entries));
      }
    } catch (error) {
      // The default recent render still gives us a best-effort jump target.
    }
  }
  window.setTimeout(() => {
    const target = draftId ? document.querySelector(`[data-draft-id="${CSS.escape(draftId)}"]`) : null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("jump-highlight");
      window.setTimeout(() => target.classList.remove("jump-highlight"), 1800);
    } else {
      showChatToast("已打开对应房间；这条消息可能不在最近加载范围里。", "warning", 2600);
    }
  }, 80);
}

async function openChatRoom(room) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  activatePanel("chat");
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.chatRoom === safeRoom);
  });
  await renderChatProfile(safeRoom);
}

function renderDryRunReply(profile, packagePath) {
  return `
    <div class="bubble theirs dry-run-reply">
      <span>${escapeHtml(profile.name)} · dry run</span>
      <p>请求包已经准备好，但还没有真正调用模型。</p>
      <small>${escapeHtml(packagePath || "outbox 未写入")}</small>
    </div>
  `;
}

function renderAgentReply(profile, data) {
  const records = Array.isArray(data.records) && data.records.length
    ? data.records
    : (data.record ? [data.record] : []);
  if (records.length) {
    return records
      .map((record) => renderDraftBubble({ ...record, room: "aimas", role: "assistant" }))
      .join("");
  }
  return `
    <div class="bubble theirs agent-reply">
      <span>${escapeHtml(profile.name)} · Hermes</span>
      <p>${escapeHtml(data.reply || "Aimas 有返回，但没有解析到文本。")}</p>
      <small>${escapeHtml(data.model || "hermes-agent")} · status ${escapeHtml(data.status || "")}</small>
    </div>
  `;
}

function renderProviderReply(profile, data) {
  const record = data.record;
  if (record) {
    return renderDraftBubble({ ...record, room: data.room || selectedChatRoom, role: "assistant" });
  }
  return `
    <div class="bubble theirs agent-reply">
      <span>${escapeHtml(profile.name)} · ${escapeHtml(data.provider?.name || "API")}</span>
      <p>${escapeHtml(data.reply || "API 有返回，但没有解析到文本。")}</p>
      <small>${escapeHtml(data.model || "")} · status ${escapeHtml(data.status || "")}</small>
    </div>
  `;
}

function appendContextReceipt(currentText, title, data = {}) {
  const routeType = data.route?.type || (data.endpoint ? "agent" : "unknown");
  const routeId = data.route?.route_id || data.provider?.id || data.endpoint || "none";
  const context = data.memory_context_markdown || "";
  const providerName = data.provider?.name || data.provider?.id || data.model || "unknown";
  const isAgent = routeType === "agent" || Boolean(data.endpoint);
  const preview = data.context_preview ? formatContextPreview(data.context_preview, false) : "";
  return `${currentText}\n\n` +
    `# 5. 对方回复后，小窝记录了什么\n\n` +
    `- 回复来源：${title}\n` +
    `- 路线：${routeType} / ${routeId}\n` +
    `- 模型/来源：${providerName}\n` +
    `- 同房间短期上下文：${formatNumber(data.short_context_messages || 0)} 条\n` +
    `- 长期记忆候选：${data.memory_context_used ? "已随请求带入" : "没有命中或没有带入"}\n` +
    `- HTTP 状态：${data.status || "?"}\n` +
    `- 可见性说明：${isAgent ? "Aimas/Hermes 可能只把用户消息暴露给本体自省层；小窝这边已把上下文作为 system/request 层递出。" : "普通 provider 通常能同时接收 system、短期聊天和长期记忆候选。"}\n\n` +
    (preview ? `## 6. 实际调用回执里的上下文预览\n\n${preview}\n\n` : "") +
    (context ? `## 7. 这次随请求递出的长期记忆草稿\n\n${context}` : "## 7. 这次随请求递出的长期记忆草稿\n\n无。");
}

async function renderChatProfile(key) {
  const profile = chatProfiles[key] || chatProfiles.linxu;
  const avatar = chatAvatarMeta(key);
  selectedChatRoom = key;
  closeProfileSheet({ restore: false });
  closeChatInfoSheet();
  document.querySelector(".phone-shell")?.classList.add("chat-focus");
  document.getElementById("chatWindow")?.classList.add("detail-open");
  const avatarNode = document.getElementById("chatHeaderAvatar");
  setAvatarNode(avatarNode, key, "conversation-avatar chat-app-avatar");
  document.getElementById("chatSessionName").textContent = profile.name;
  document.getElementById("chatBoundary").textContent = profile.boundary;
  document.getElementById("chatThread").innerHTML = `
    <div class="bubble theirs" data-bubble-author="${escapeHtml(key)}">
      <span>${escapeHtml(profile.name)}</span>
      <p>${escapeHtml(profile.hello)}</p>
      <div class="bubble-actions">
        <button type="button" data-bubble-moment>发圈圈</button>
      </div>
    </div>
    <div class="bubble mine" data-bubble-author="me">
      <span>你</span>
      <p>今天只是想看看小窝长什么样。</p>
      <div class="bubble-actions">
        <button type="button" data-bubble-moment>发圈圈</button>
      </div>
    </div>
    <div class="bubble system">
      <span>记忆门牌</span>
      <p>${escapeHtml(profile.system)}</p>
    </div>
    <div id="savedDraftsSlot"></div>
  `;
  applyChatPreferences(key);
  renderChatInfoSheet(key);
  const slot = document.getElementById("savedDraftsSlot");
  slot.innerHTML = renderSavedDrafts(readBrowserDrafts(key));
  try {
    const data = await fetchSessionLog(key);
    if (selectedChatRoom !== key) {
      return;
    }
    const merged = mergeDraftEntries(readBrowserDrafts(key), data.entries);
    slot.innerHTML = renderSavedDrafts(merged);
    const thread = document.getElementById("chatThread");
    thread.scrollTop = thread.scrollHeight;
  } catch (error) {
    // Static file preview still restores drafts from the browser cache.
  }
}

function renderProfileSheet(room = selectedChatRoom) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  const profile = chatProfiles[safeRoom] || chatProfiles.linxu;
  setAvatarNode(document.getElementById("profileAvatar"), safeRoom);
  const cover = document.getElementById("profileCover");
  const assets = profileAssetFor(safeRoom);
  if (cover) {
    cover.style.backgroundImage = assets.background ? `url("${assets.background}")` : "";
    cover.classList.toggle("has-image", Boolean(assets.background));
  }
  const name = roomLabels[safeRoom] || profile.name;
  const type = profile.group === "group" ? "公共 shared 房间" : "独立 session";
  const route = routeSummaryForRoom(safeRoom);
  const nameNode = document.getElementById("profileName");
  const previewNode = document.getElementById("profilePreview");
  const boundaryNode = document.getElementById("profileBoundary");
  const aliasNode = document.getElementById("profileAlias");
  const typeNode = document.getElementById("profileType");
  const routeNode = document.getElementById("profileRoute");
  const modelNode = document.getElementById("profileModel");
  if (nameNode) nameNode.textContent = name;
  if (previewNode) previewNode.textContent = profile.preview || type;
  if (boundaryNode) boundaryNode.textContent = profile.boundary;
  if (aliasNode) aliasNode.textContent = name;
  if (typeNode) typeNode.textContent = type;
  if (routeNode) routeNode.textContent = `${route.route} · ${route.endpoint}`;
  if (modelNode) modelNode.textContent = route.model;
}

function openProfileSheet(options = {}) {
  profileReturnTarget = options.returnTo || "chat";
  renderProfileSheet(selectedChatRoom);
  document.getElementById("profileSheet")?.removeAttribute("hidden");
}

function closeProfileSheet(options = {}) {
  const restore = options.restore !== false;
  document.getElementById("profileSheet")?.setAttribute("hidden", "");
  if (restore && profileReturnTarget === "info") {
    profileReturnTarget = "chat";
    openChatInfoSheet();
  }
}

function renderChatInfoSheet(room = selectedChatRoom) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  const profile = chatProfiles[safeRoom] || chatProfiles.linxu;
  const prefs = chatPrefsFor(safeRoom);
  setAvatarNode(document.getElementById("chatInfoAvatar"), safeRoom);
  const nameNode = document.getElementById("chatInfoName");
  const boundaryNode = document.getElementById("chatInfoBoundary");
  const pinButton = document.getElementById("chatInfoPinButton");
  const pinNode = document.getElementById("chatInfoPinState");
  const backgroundNode = document.getElementById("chatBackgroundState");
  if (nameNode) nameNode.textContent = roomLabels[safeRoom] || profile.name;
  if (boundaryNode) boundaryNode.textContent = profile.boundary;
  if (pinButton) {
    pinButton.classList.toggle("is-on", Boolean(prefs.pinned));
    pinButton.setAttribute("aria-pressed", prefs.pinned ? "true" : "false");
  }
  if (pinNode) pinNode.title = prefs.pinned ? "已置顶" : "未置顶";
  if (backgroundNode) backgroundNode.textContent = (profileAssetFor(safeRoom).chat_background || prefs.background) ? "已设置" : "未设置";
}

function openChatInfoSheet() {
  closeProfileSheet({ restore: false });
  renderChatInfoSheet(selectedChatRoom);
  document.getElementById("chatInfoSheet")?.removeAttribute("hidden");
}

function closeChatInfoSheet() {
  document.getElementById("chatInfoSheet")?.setAttribute("hidden", "");
  clearChatSearch();
}

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

async function saveChatBackground(dataUrl) {
  const room = selectedChatRoom || "linxu";
  const data = await saveRoomAsset(room, "chat_background", dataUrl);
  updateChatPrefs(room, { background: data?.url || dataUrl });
  showChatToast(data?.temporary ? "聊天背景已临时保存到这个浏览器。" : `聊天背景已保存到 D 盘：${data.relative_path}`, "success", 2400);
}

async function saveMomentCover(dataUrl) {
  const room = momentAuthors[currentMomentScope] ? currentMomentScope : "me";
  const data = await saveRoomAsset(room, "moment_background", dataUrl);
  applyProfileAssetsToVisibleNodes(room);
  showChatToast(data?.temporary ? "圈圈封面已临时保存到这个浏览器。" : `圈圈封面已保存到 D 盘：${data.relative_path}`, "success", 2400);
}

async function clearCurrentChatScreen() {
  const room = selectedChatRoom || "linxu";
  const ok = await openAppDialog({
    kicker: "CHAT",
    title: "清空当前屏幕？",
    message: "这一版只清掉当前浏览器草稿和屏幕上已加载的最近消息，不删除 D 盘 session 文件，也不影响记忆库。",
    cancelText: "先不清",
    confirmText: "清空屏幕"
  });
  if (!ok) {
    return;
  }
  if (!browserStore.removeBrowserDraft(room)) {
    // The visible screen can still be cleared even if browser storage is unavailable.
  }
  const slot = document.getElementById("savedDraftsSlot");
  if (slot) {
    slot.innerHTML = "";
  }
  updateConversationPreview(room, []);
  closeChatInfoSheet();
  showChatToast("当前屏幕已清空；D 盘记录还在。", "success", 2400);
}
async function sendChatDraft() {
  const input = document.getElementById("chatDraft");
  const thread = document.getElementById("chatThread");
  const contextOutput = document.getElementById("chatContextOutput");
  const contextDrawer = document.getElementById("chatContextDrawer");
  const text = input?.value?.trim();
  const resident = selectedChatRoom || "linxu";
  const profile = chatProfiles[resident] || chatProfiles.linxu;
  if (!text) {
    return;
  }
  const draftRecord = writeBrowserDraft(resident, text);
  updateConversationPreview(resident);
  thread.insertAdjacentHTML(
    "beforeend",
    renderDraftBubble(draftRecord)
  );
  showChatToast("浏览器已存，正在同步 D 盘...", "info", 1800);
  input.value = "";
  resizeChatDraftInput();
  input.focus();
  thread.scrollTop = thread.scrollHeight;
  contextDrawer.open = true;
  contextOutput.textContent = "正在生成本地 API 请求包...";

  try {
    const saved = await saveSessionMessage(resident, draftRecord);
    showChatToast(`D 盘已存：${saved.relative_path}`, "success", 2400);
    refreshConversationPreview(resident);
  } catch (error) {
    showChatToast(`仅浏览器已存：${error.message}`, "warning", 3000);
  }

  buildChatPackage(resident, draftRecord)
    .then((data) => {
      contextOutput.textContent = formatRequestPackage(data, profile, text);
      if (resident === "aimas") {
        showChatToast("请求包已准备，正在呼叫 Aimas / Hermes...", "info", 2600);
        return callAimasAgent(draftRecord)
          .then((agentData) => {
            thread.insertAdjacentHTML("beforeend", renderAgentReply(profile, agentData));
            const records = Array.isArray(agentData.records) && agentData.records.length
              ? agentData.records
              : (agentData.record ? [agentData.record] : []);
            if (records.length) {
              records.forEach((record) => writeBrowserEntry(resident, record));
              updateConversationPreview(resident);
            }
            thread.scrollTop = thread.scrollHeight;
            contextOutput.textContent = appendContextReceipt(
              contextOutput.textContent,
              "Aimas / Hermes 实际上下文",
              agentData
            );
            showChatToast(records.length > 1 ? `Aimas 发来了 ${records.length} 条` : "Aimas 已回复", "success", 2200);
          });
      }
      if (resident !== "living") {
        showChatToast("请求包已准备，正在呼叫当前 provider...", "info", 2600);
        return callProviderModel(resident, draftRecord)
          .then((providerData) => {
            thread.insertAdjacentHTML("beforeend", renderProviderReply(profile, providerData));
            if (providerData.record) {
              writeBrowserEntry(resident, providerData.record);
              updateConversationPreview(resident);
            }
            thread.scrollTop = thread.scrollHeight;
            contextOutput.textContent = appendContextReceipt(
              contextOutput.textContent,
              "真实 API 实际上下文",
              providerData
            );
            showChatToast(`${profile.name} 已通过真实 API 回复`, "success", 2400);
          })
          .catch((error) => {
            thread.insertAdjacentHTML("beforeend", renderDryRunReply(profile, data.relative_path));
            thread.scrollTop = thread.scrollHeight;
            contextOutput.textContent +=
              `\n\n# 真实 API 暂未发出\n\n` +
              `原因：${error.message}\n\n` +
              `这条消息已保留 dry-run 请求包；填好 provider 的 Model 和 API Key 后再发就会真正调用。`;
            showChatToast(`真实 API 未完成：${error.message}`, "warning", 3600);
          });
      }
      thread.insertAdjacentHTML("beforeend", renderDryRunReply(profile, data.relative_path));
      thread.scrollTop = thread.scrollHeight;
      showChatToast("客厅暂时仍是 shared dry-run", "success", 2200);
    })
    .catch((error) => {
      contextOutput.textContent =
        "这次没有完成发送链路。\n\n" +
        "如果是静态页面，请启动 start-stillgarden.bat。若 Aimas 探针已通过但聊天失败，请看 Hermes 网关日志。\n\n" +
        `当前原因：${error.message}\n` +
        `当前 session：${profile.name}\n` +
        `当前消息：${text}`;
      showChatToast(`发送链路失败：${error.message}`, "warning", 3600);
    });
}

function initChatController() {
  document.getElementById("chatSendButton")?.addEventListener("click", sendChatDraft);

  document.getElementById("chatDraft")?.addEventListener("input", resizeChatDraftInput);

  document.getElementById("chatDraft")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    sendChatDraft();
  });

  document.getElementById("chatResident")?.addEventListener("change", (event) => {
    document.querySelectorAll(".conversation-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.chatRoom === event.target.value);
    });
    renderChatProfile(event.target.value);
  });

  document.querySelectorAll(".conversation-item").forEach((button) => {
    button.addEventListener("click", () => {
      const room = button.dataset.chatRoom || "linxu";
      document.querySelectorAll(".conversation-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderChatProfile(room);
    });
  });

  document.getElementById("chatBackButton")?.addEventListener("click", () => {
    document.querySelector(".phone-shell")?.classList.remove("chat-focus");
    document.getElementById("chatWindow")?.classList.remove("detail-open");
    closeChatInfoSheet();
    closeProfileSheet();
    refreshAllConversationPreviews();
  });
}

