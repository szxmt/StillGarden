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
