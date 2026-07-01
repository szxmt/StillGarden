function chatAvatarMeta(room) {
  const meta = {
    linxu: { text: "林", className: "moon" },
    dengdeng: { text: "噔", className: "sun" },
    aimas: { text: "A", className: "terminal" },
    living: { text: "厅", className: "living" }
  };
  return meta[room] || meta.linxu;
}

function profileAssetsKey() {
  return browserStore.profileAssetsKey();
}

function readProfileAssets() {
  return browserStore.readProfileAssets();
}

function writeProfileAssets(assets) {
  if (!browserStore.writeProfileAssets(assets)) {
    showChatToast("图片有点大，浏览器没有存下。", "warning", 2600);
  }
}

function profileAssetFor(room) {
  const key = momentAuthors[room] ? room : "me";
  return {
    ...(readProfileAssets()[key] || {}),
    ...(serverProfileAssets[key] || {})
  };
}

async function loadProfileAssets() {
  if (!serviceOnline) {
    return;
  }
  try {
    const data = await appApi.getProfileAssets();
    const nextAssets = data.assets || {};
    const nextSignature = JSON.stringify(nextAssets);
    if (profileAssetsLoaded && nextSignature === profileAssetsSignature) {
      return;
    }
    serverProfileAssets = nextAssets;
    profileAssetsSignature = nextSignature;
    profileAssetsLoaded = true;
    ["me", "linxu", "dengdeng", "aimas", "living"].forEach((room) => applyProfileAssetsToVisibleNodes(room));
  } catch (error) {
    profileAssetsLoaded = false;
  }
}

function avatarInlineStyle(room) {
  const avatar = profileAssetFor(room).avatar;
  return avatar ? ` style="background-image: url('${escapeHtml(avatar)}')"` : "";
}

function avatarClass(room, baseClass = "conversation-avatar") {
  const meta = momentAvatarMeta(room);
  return `${baseClass} ${meta.className}${profileAssetFor(room).avatar ? " has-image" : ""}`;
}

function avatarText(room) {
  return profileAssetFor(room).avatar ? "" : momentAvatarMeta(room).text;
}

function renderAvatar(author, baseClass = "conversation-avatar") {
  return `<span class="${escapeHtml(avatarClass(author, baseClass))}"${avatarInlineStyle(author)}>${escapeHtml(avatarText(author))}</span>`;
}

function setAvatarNode(node, room, className = "conversation-avatar") {
  if (!node) {
    return;
  }
  const meta = momentAvatarMeta(room);
  const assets = profileAssetFor(room);
  node.textContent = assets.avatar ? "" : meta.text;
  node.className = `${className} ${meta.className}${assets.avatar ? " has-image" : ""}`;
  node.style.backgroundImage = assets.avatar ? `url("${assets.avatar}")` : "";
}

function routeSummaryForRoom(room) {
  const config = apiConfigCache || normalizeApiConfig(defaultApiConfig);
  if (room === "aimas") {
    const connector = config.agent_connectors?.aimas || {};
    return {
      route: "agent / Aimas-Hermes",
      model: `${connector.model || "hermes-agent"} · ${connector.key_saved ? "key 已保存" : "key 未保存"}`,
      endpoint: connector.endpoint || "endpoint 未设置"
    };
  }
  if (room === "living") {
    return {
      route: "shared / 客厅",
      model: "不直接调用模型 · 只放公共上下文",
      endpoint: "shared only"
    };
  }
  const fallback = room === "dengdeng" ? "gg" : "oa";
  const routeId = config.room_routes?.[room] || fallback;
  const provider = allConfigProviders(config).find((item) => item.id === routeId);
  if (!provider) {
    return {
      route: `${routeId || "unknown"} / 未找到`,
      model: "配置缺失",
      endpoint: "未连接"
    };
  }
  return {
    route: `${isCustomProvider(provider) ? "custom provider" : "provider"} / ${provider.name || provider.id}`,
    model: `${provider.model || "未设置"} · ${provider.key_saved ? "key 已保存" : "key 未保存"}`,
    endpoint: provider.base_url || "base URL 未设置"
  };
}

function applyProfileAssetsToVisibleNodes(room = selectedChatRoom) {
  const safeRoom = momentAuthors[room] ? room : "me";
  const profileSheet = document.getElementById("profileSheet");
  const chatInfoSheet = document.getElementById("chatInfoSheet");
  if (safeRoom === selectedChatRoom) {
    setAvatarNode(document.getElementById("chatHeaderAvatar"), safeRoom, "conversation-avatar chat-app-avatar");
    if (!profileSheet?.hasAttribute("hidden")) {
      renderProfileSheet(safeRoom);
    }
    if (!chatInfoSheet?.hasAttribute("hidden")) {
      renderChatInfoSheet(safeRoom);
    }
  }
  document.querySelectorAll(`[data-chat-room="${safeRoom}"] .conversation-avatar`).forEach((node) => {
    setAvatarNode(node, safeRoom);
  });
  document.querySelectorAll(`[data-resident="${safeRoom}"] .avatar`).forEach((node) => {
    setAvatarNode(node, safeRoom, "avatar");
  });
  if (safeRoom === "me" && document.getElementById("myProfilePanel")?.classList.contains("active-subpage")) {
    renderMyProfilePanel();
  }
  updateMomentHero();
  renderMoments();
}
async function saveRoomAsset(room, kind, dataUrl) {
  const safeRoom = momentAuthors[room] ? room : "linxu";
  const assets = readProfileAssets();
  if (serviceOnline) {
    try {
      const data = await appApi.saveProfileAsset({ room: safeRoom, kind, data_url: dataUrl });
      serverProfileAssets = data.assets || {};
      profileAssetsSignature = JSON.stringify(serverProfileAssets);
      profileAssetsLoaded = true;
      assets[safeRoom] = {
        ...(assets[safeRoom] || {}),
        [kind]: data.url
      };
      writeProfileAssets(assets);
      return data;
    } catch (error) {
      showChatToast(`D 盘保存失败，先临时放浏览器：${error.message}`, "warning", 3000);
    }
  }
  assets[safeRoom] = {
    ...(assets[safeRoom] || {}),
    [kind]: dataUrl
  };
  writeProfileAssets(assets);
  return { ok: true, url: dataUrl, temporary: true };
}

async function saveProfileImage(kind, dataUrl) {
  const room = selectedChatRoom || "linxu";
  const data = await saveRoomAsset(room, kind, dataUrl);
  renderProfileSheet(room);
  applyProfileAssetsToVisibleNodes(room);
  if (data?.temporary) {
    showChatToast(kind === "avatar" ? "头像已临时保存到这个浏览器。" : "背景已临时保存到这个浏览器。", "success", 2200);
    return;
  }
  showChatToast(kind === "avatar" ? `头像已保存到 D 盘：${data.relative_path}` : `背景已保存到 D 盘：${data.relative_path}`, "success", 2600);
}

async function clearProfileImages() {
  const room = selectedChatRoom || "linxu";
  const assets = readProfileAssets();
  if (serviceOnline) {
    try {
      const data = await appApi.clearProfileAssets({ room, kinds: ["avatar", "background"] });
      serverProfileAssets = data.assets || {};
      profileAssetsSignature = JSON.stringify(serverProfileAssets);
      profileAssetsLoaded = true;
    } catch (error) {
      showChatToast(`D 盘清除失败，只清浏览器临时图：${error.message}`, "warning", 2600);
    }
  }
  delete assets[room];
  writeProfileAssets(assets);
  renderProfileSheet(room);
  applyProfileAssetsToVisibleNodes(room);
  showChatToast("这个房间的头像和背景已清除。", "success", 2200);
}

function renderMyProfilePanel() {
  refreshMyNicknameLabels();
  setAvatarNode(document.getElementById("myProfileAvatar"), "me");
  const cover = document.getElementById("myProfileCover");
  const assets = profileAssetFor("me");
  if (cover) {
    cover.style.backgroundImage = assets.background ? `url("${assets.background}")` : "";
    cover.classList.toggle("has-image", Boolean(assets.background));
  }
}

async function saveMyNickname() {
  const input = document.getElementById("myProfileNicknameInput");
  const statusText = (input?.value || "").trim().slice(0, 20);
  const nickname = statusText || "小宝";
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  apiConfigCache.user_profile = { nickname };
  refreshMyNicknameLabels();
  if (!serviceOnline) {
    showChatToast("昵称已先改在当前页面；连上本地服务后再保存到 D 盘。", "warning", 2600);
    renderMoments();
    return;
  }
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    renderMoments();
    showChatToast("昵称已保存。", "success", 1800);
  } catch (error) {
    showChatToast(`昵称保存失败：${error.message}`, "warning", 2600);
  }
}

async function saveMyProfileImage(kind, dataUrl) {
  const data = await saveRoomAsset("me", kind, dataUrl);
  renderMyProfilePanel();
  applyProfileAssetsToVisibleNodes("me");
  showChatToast(data?.temporary
    ? (kind === "avatar" ? "我的头像已临时保存到这个浏览器。" : "我的背景已临时保存到这个浏览器。")
    : (kind === "avatar" ? `我的头像已保存到 D 盘：${data.relative_path}` : `我的背景已保存到 D 盘：${data.relative_path}`),
    "success",
    2400);
}

async function clearMyProfileImages() {
  const assets = readProfileAssets();
  if (serviceOnline) {
    try {
      const data = await appApi.clearProfileAssets({ room: "me", kinds: ["avatar", "background"] });
      serverProfileAssets = data.assets || {};
      profileAssetsSignature = JSON.stringify(serverProfileAssets);
      profileAssetsLoaded = true;
    } catch (error) {
      showChatToast(`D 盘清除失败，只清浏览器临时图：${error.message}`, "warning", 2600);
    }
  }
  if (assets.me) {
    delete assets.me.avatar;
    delete assets.me.background;
  }
  writeProfileAssets(assets);
  renderMyProfilePanel();
  applyProfileAssetsToVisibleNodes("me");
  showChatToast("我的头像和背景已清除。", "success", 2200);
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
function initProfileController() {
  document.getElementById("profileButton")?.addEventListener("click", openProfileSheet);
  document.getElementById("chatHeaderAvatar")?.addEventListener("click", openProfileSheet);
  document.getElementById("chatInfoButton")?.addEventListener("click", openChatInfoSheet);
  document.getElementById("chatInfoCloseButton")?.addEventListener("click", closeChatInfoSheet);
  document.getElementById("chatInfoProfileButton")?.addEventListener("click", () => {
    closeChatInfoSheet();
    openProfileSheet({ returnTo: "info" });
  });
  document.getElementById("chatInfoPinButton")?.addEventListener("click", () => {
    const prefs = chatPrefsFor(selectedChatRoom);
    updateChatPrefs(selectedChatRoom, { pinned: !prefs.pinned });
    showChatToast(!prefs.pinned ? "这个会话已置顶。" : "已取消置顶。", "success", 1800);
  });
  document.getElementById("chatBackgroundButton")?.addEventListener("click", () => {
    document.getElementById("chatBackgroundInput")?.click();
  });
  document.getElementById("chatBackgroundInput")?.addEventListener("change", (event) => {
    readImageFileAsDataUrl(event.target.files?.[0], saveChatBackground, { serverAsset: true });
    event.target.value = "";
  });
  document.getElementById("chatClearScreenButton")?.addEventListener("click", clearCurrentChatScreen);
  document.getElementById("chatSearchInput")?.addEventListener("input", runChatSearch);
  document.getElementById("chatSearchResults")?.addEventListener("click", handleChatSearchResultClick);
  document.getElementById("profileCloseButton")?.addEventListener("click", closeProfileSheet);
  document.getElementById("profileRenameButton")?.addEventListener("click", () => {
    closeProfileSheet();
    document.getElementById("renameRoomButton")?.click();
  });
  document.getElementById("profileMomentsButton")?.addEventListener("click", () => {
    const room = selectedChatRoom || "linxu";
    closeProfileSheet({ restore: false });
    closeChatInfoSheet();
    activatePanel("more");
    openSubpage("momentsPanel");
    setMomentScope(momentAuthors[room] ? room : "all");
  });
  document.getElementById("profileAvatarButton")?.addEventListener("click", () => {
    document.getElementById("profileAvatarInput")?.click();
  });
  document.getElementById("profileBackgroundButton")?.addEventListener("click", () => {
    document.getElementById("profileBackgroundInput")?.click();
  });
  document.getElementById("profileClearImagesButton")?.addEventListener("click", async () => {
    const ok = await openAppDialog({
      kicker: "PROFILE",
      title: "清除头像和背景？",
      message: "会清除这个房间的头像/背景登记，不影响记忆库和聊天记录；D 盘旧图片文件暂时保留，后续统一做回收站。",
      cancelText: "先不清",
      confirmText: "清除图片"
    });
    if (ok) {
      clearProfileImages();
    }
  });
  document.getElementById("profileAvatarInput")?.addEventListener("change", (event) => {
    readImageFileAsDataUrl(event.target.files?.[0], (dataUrl) => saveProfileImage("avatar", dataUrl), { serverAsset: true });
    event.target.value = "";
  });
  document.getElementById("profileBackgroundInput")?.addEventListener("change", (event) => {
    readImageFileAsDataUrl(event.target.files?.[0], (dataUrl) => saveProfileImage("background", dataUrl), { serverAsset: true });
    event.target.value = "";
  });
  document.getElementById("myProfileAvatarButton")?.addEventListener("click", () => {
    document.getElementById("myProfileAvatarInput")?.click();
  });
  document.getElementById("myProfileBackgroundButton")?.addEventListener("click", () => {
    document.getElementById("myProfileBackgroundInput")?.click();
  });
  document.getElementById("myProfileMomentsButton")?.addEventListener("click", () => {
    openSubpage("momentsPanel");
    setMomentScope("me");
  });
  document.getElementById("myProfileSaveButton")?.addEventListener("click", saveMyNickname);
  document.getElementById("myProfileClearImagesButton")?.addEventListener("click", async () => {
    const ok = await openAppDialog({
      kicker: "ME",
      title: "清除我的头像和背景？",
      message: "只清除我的头像/个人背景登记，不影响圈圈封面、聊天记录和记忆库。",
      cancelText: "先不清",
      confirmText: "清除图片"
    });
    if (ok) {
      clearMyProfileImages();
    }
  });
  document.getElementById("myProfileAvatarInput")?.addEventListener("change", (event) => {
    readImageFileAsDataUrl(event.target.files?.[0], (dataUrl) => saveMyProfileImage("avatar", dataUrl), { serverAsset: true });
    event.target.value = "";
  });
  document.getElementById("myProfileBackgroundInput")?.addEventListener("change", (event) => {
    readImageFileAsDataUrl(event.target.files?.[0], (dataUrl) => saveMyProfileImage("background", dataUrl), { serverAsset: true });
    event.target.value = "";
  });
}

