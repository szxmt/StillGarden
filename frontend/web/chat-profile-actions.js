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
