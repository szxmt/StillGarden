async function loadApiConfig() {
  const providerSelect = document.getElementById("providerSelect");
  const mode = document.getElementById("apiModeLabel");
  const aimasEndpoint = document.getElementById("aimasEndpoint");
  const aimasLabel = document.getElementById("aimasConnectorLabel");
  const status = document.getElementById("apiConfigStatus");
  if (!providerSelect || !status) {
    return;
  }
  if (!serviceOnline) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
    refreshMyNicknameLabels();
    renderApiConfig(selectedProviderId);
    status.textContent = "未连接本地服务：配置暂时只显示默认值。";
    return;
  }
  try {
    const data = await appApi.getConfig();
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    renderApiConfig(selectedProviderId);
    status.textContent = `已读取：${data.relative_path}`;
    apiConfigLoaded = true;
  } catch (error) {
    status.textContent = `配置读取失败：${error.message}`;
  }
}

async function saveApiConfig() {
  const status = document.getElementById("apiConfigStatus");
  if (!status) {
    return;
  }
  if (!serviceOnline) {
    status.textContent = "未连接本地服务：不能写入 D 盘配置。";
    return;
  }
  status.textContent = "正在保存配置...";
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    const aimasApiKey = document.getElementById("aimasApiKey");
    if (aimasApiKey) {
      aimasApiKey.value = "";
    }
    const providerApiKey = document.getElementById("providerApiKey");
    if (providerApiKey) {
      providerApiKey.value = "";
    }
    renderApiConfig(selectedProviderId);
    status.textContent = `已保存：${data.relative_path}。发送时会在配置齐全的房间尝试真实 API。`;
  } catch (error) {
    status.textContent = `配置保存失败：${error.message}`;
  }
}

async function saveSelfAccessConfig() {
  const status = document.getElementById("selfAccessStatus");
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  apiConfigCache.self_access = normalizeSelfAccess(selfAccessFromControls());
  renderSelfAccessPanel();
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：self 开关暂时不能写入 D 盘。";
    return;
  }
  if (status) status.textContent = "正在保存 self 可读范围...";
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    renderApiConfig(selectedProviderId);
    if (status) status.textContent = "self 可读范围已保存。";
  } catch (error) {
    if (status) status.textContent = `self 开关保存失败：${error.message}`;
  }
}

function myNickname() {
  return normalizeUserProfile(apiConfigCache?.user_profile || defaultApiConfig.user_profile).nickname;
}

function refreshMyNicknameLabels() {
  momentAuthors.me = myNickname();
  const name = document.getElementById("myProfileName");
  const preview = document.getElementById("myProfilePreview");
  const input = document.getElementById("myProfileNicknameInput");
  const momentMeOption = document.querySelector('#momentAuthor option[value="me"]');
  if (name) name.textContent = momentAuthors.me;
  if (preview) preview.textContent = `${momentAuthors.me}的小窝视角。`;
  if (input && document.activeElement !== input) input.value = momentAuthors.me;
  if (momentMeOption) momentMeOption.textContent = momentAuthors.me;
  if (currentMomentScope === "all" || currentMomentScope === "me") {
    updateMomentHero();
  }
}

function selfAccessFromControls() {
  const readers = {};
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    readers[input.dataset.selfReader] = input.getAttribute("aria-pressed") === "true";
  });
  const anyReader = Object.values(readers).some(Boolean);
  return {
    enabled: document.getElementById("selfAccessMaster")?.getAttribute("aria-pressed") === "true" && anyReader,
    readers: {
      linxu: Boolean(readers.linxu),
      dengdeng: Boolean(readers.dengdeng),
      aimas: Boolean(readers.aimas)
    }
  };
}

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

function renderSelfAccessPanel() {
  const selfAccess = normalizeSelfAccess(apiConfigCache?.self_access || defaultApiConfig.self_access);
  const master = document.getElementById("selfAccessMaster");
  if (master) {
    master.setAttribute("aria-pressed", selfAccess.enabled ? "true" : "false");
    master.setAttribute("aria-expanded", selfAccess.enabled ? "true" : "false");
    master.classList.toggle("is-on", selfAccess.enabled);
  }
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    const reader = input.dataset.selfReader;
    const isOn = Boolean(selfAccess.enabled && selfAccess.readers?.[reader]);
    input.setAttribute("aria-pressed", isOn ? "true" : "false");
    input.classList.toggle("is-on", isOn);
  });
  document.getElementById("selfAccessReaders")?.classList.toggle("is-open", selfAccess.enabled);
  const openReaders = Object.entries(selfAccess.readers || {})
    .filter(([, enabled]) => enabled)
    .map(([reader]) => selfReaderLabels[reader] || reader);
  const text = selfAccess.enabled
    ? `self：已开启，${openReaders.join("、") || "未选择"}可读`
    : "self：关闭，不会带入任何请求";
  const status = document.getElementById("selfAccessStatus");
  if (status) status.textContent = text;
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

function applyRoomLabels(labels = {}) {
  Object.keys(roomLabels).forEach((room) => {
    const nextLabel = labels[room] || defaultApiConfig.room_labels[room] || roomLabels[room];
    roomLabels[room] = nextLabel;
    if (chatProfiles[room]) {
      chatProfiles[room].name = nextLabel;
    }
    const name = document.querySelector(`[data-chat-name="${room}"]`);
    if (name) {
      name.textContent = nextLabel;
    }
  });
  const activeProfile = chatProfiles[selectedChatRoom] || chatProfiles.linxu;
  const title = document.getElementById("chatSessionName");
  if (title) {
    title.textContent = activeProfile.name;
  }
}

function allConfigProviders(config = apiConfigCache) {
  if (!config) {
    return [];
  }
  const lines = [
    config.providers.oa,
    config.providers.gg,
    ...(config.custom_providers || [])
  ].filter(Boolean);
  return lines;
}

function findConfigProvider(id) {
  return allConfigProviders().find((item) => item.id === id) || null;
}

function isCustomProvider(provider) {
  return provider?.kind === "custom" || provider?.provider === "custom" || provider?.id?.startsWith("custom-");
}

function providerLabel(provider) {
  if (!provider) {
    return "未选择";
  }
  return isCustomProvider(provider) ? `${provider.name || "自定义"} · custom` : provider.name;
}

function syncSelectedProviderToCache() {
  if (!apiConfigCache || !selectedProviderId) {
    return;
  }
  const provider = findConfigProvider(selectedProviderId);
  if (!provider) {
    return;
  }
  const name = document.getElementById("providerName")?.value?.trim();
  const baseUrl = document.getElementById("providerBaseUrl")?.value?.trim();
  const model = document.getElementById("providerModel")?.value?.trim();
  const keyAlias = document.getElementById("providerKeyAlias")?.value?.trim();
  if (isCustomProvider(provider)) {
    provider.name = name || provider.name || "自定义";
  }
  provider.base_url = baseUrl || "";
  provider.model = model || "未设置";
  provider.key_alias = keyAlias || "";
}

function renderRouteSelects() {
  if (!apiConfigCache) {
    return;
  }
  const options = allConfigProviders()
    .map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(providerLabel(provider))}</option>`)
    .join("");
  [
    ["linxuProviderRoute", "linxu", "oa"],
    ["dengdengProviderRoute", "dengdeng", "gg"]
  ].forEach(([elementId, room, fallback]) => {
    const select = document.getElementById(elementId);
    if (!select) {
      return;
    }
    select.innerHTML = options;
    const routeId = apiConfigCache.room_routes?.[room] || fallback;
    select.value = findConfigProvider(routeId) ? routeId : fallback;
  });
}

function renderProviderSelect(preferredId = selectedProviderId) {
  const select = document.getElementById("providerSelect");
  if (!select || !apiConfigCache) {
    return;
  }
  const providers = allConfigProviders();
  select.innerHTML = providers
    .map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(providerLabel(provider))}</option>`)
    .join("");
  selectedProviderId = providers.some((provider) => provider.id === preferredId)
    ? preferredId
    : (providers[0]?.id || "oa");
  select.value = selectedProviderId;
}

function renderSelectedProvider() {
  const provider = findConfigProvider(selectedProviderId);
  const name = document.getElementById("providerName");
  const baseUrl = document.getElementById("providerBaseUrl");
  const model = document.getElementById("providerModel");
  const keyAlias = document.getElementById("providerKeyAlias");
  const apiKey = document.getElementById("providerApiKey");
  const kind = document.getElementById("providerKindLabel");
  const remove = document.getElementById("customProviderDelete");
  if (!provider || !name || !baseUrl || !model || !keyAlias) {
    return;
  }
  const custom = isCustomProvider(provider);
  name.value = provider.name || "";
  name.disabled = !custom;
  baseUrl.value = provider.base_url || "";
  model.value = provider.model || "未设置";
  keyAlias.value = provider.key_alias || "";
  if (apiKey) {
    apiKey.value = "";
    apiKey.placeholder = provider.key_saved ? "key 已保存；留空表示不改" : "粘贴 API Key，保存后不会回显";
  }
  if (kind) {
    kind.textContent = `${custom ? "自定义中转站" : "内置门牌"} · ${provider.key_saved ? "key 已保存" : "key 未保存"}`;
  }
  if (remove) {
    remove.disabled = !custom;
    remove.textContent = custom ? "删除当前自定义" : "内置不可删除";
  }
}

function renderApiConfig(preferredId = selectedProviderId) {
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  applyRoomLabels(apiConfigCache.room_labels);
  renderProviderSelect(preferredId);
  renderSelectedProvider();
  renderRouteSelects();
  renderSelfAccessPanel();
  renderMomentsAutoCommentsPanel();
  const mode = document.getElementById("apiModeLabel");
  const aimasEndpoint = document.getElementById("aimasEndpoint");
  const aimasModel = document.getElementById("aimasModel");
  const aimasLabel = document.getElementById("aimasConnectorLabel");
  if (mode) {
    mode.textContent = `${apiConfigCache.api_mode || "live_if_configured"} · 配置齐全时联网`;
  }
  if (aimasEndpoint) {
    aimasEndpoint.value = apiConfigCache.agent_connectors?.aimas?.endpoint || "";
  }
  if (aimasModel) {
    aimasModel.value = apiConfigCache.agent_connectors?.aimas?.model || "hermes-agent";
  }
  if (aimasLabel) {
    const keyState = apiConfigCache.agent_connectors?.aimas?.key_saved ? "key 已保存" : "key 未保存";
    aimasLabel.textContent = `${apiConfigCache.agent_connectors?.aimas?.status || "planned"} · ${keyState}`;
  }
  if (!document.getElementById("profileSheet")?.hasAttribute("hidden")) {
    renderProfileSheet(selectedChatRoom);
  }
}

function collectApiConfigForSave() {
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  syncSelectedProviderToCache();
  const linxuRoute = document.getElementById("linxuProviderRoute")?.value || "oa";
  const dengdengRoute = document.getElementById("dengdengProviderRoute")?.value || "gg";
  const aimasEndpoint = document.getElementById("aimasEndpoint")?.value || "";
  const aimasModel = document.getElementById("aimasModel")?.value || "hermes-agent";
  const aimasApiKey = document.getElementById("aimasApiKey")?.value || "";
  const providerApiKey = document.getElementById("providerApiKey")?.value || "";
  return {
    selected_provider_id: selectedProviderId,
    room_labels: { ...roomLabels },
    user_profile: normalizeUserProfile(apiConfigCache?.user_profile || defaultApiConfig.user_profile),
    room_routes: {
      linxu: linxuRoute,
      dengdeng: dengdengRoute,
      living: "shared",
      aimas: "agent:aimas"
    },
    providers: {
      oa: {
        base_url: apiConfigCache?.providers?.oa?.base_url || defaultApiConfig.providers.oa.base_url,
        model: apiConfigCache?.providers?.oa?.model || "未设置",
        key_alias: apiConfigCache?.providers?.oa?.key_alias || ""
      },
      gg: {
        base_url: apiConfigCache?.providers?.gg?.base_url || defaultApiConfig.providers.gg.base_url,
        model: apiConfigCache?.providers?.gg?.model || "未设置",
        key_alias: apiConfigCache?.providers?.gg?.key_alias || ""
      }
    },
    custom_providers: apiConfigCache?.custom_providers || [],
    self_access: selfAccessFromControls(),
    moments_auto_comments: momentsAutoCommentsFromControls(),
    provider_api_key: providerApiKey,
    aimas_endpoint: aimasEndpoint,
    aimas_model: aimasModel,
    aimas_api_key: aimasApiKey
  };
}

async function createCustomProvider() {
  const status = document.getElementById("apiConfigStatus");
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：不能新建自定义 provider。";
    return;
  }
  syncSelectedProviderToCache();
  try {
    const data = await appApi.saveConfig({
      create_custom_provider: true,
      ...collectApiConfigForSave()
    });
    apiConfigCache = normalizeApiConfig(data.config);
    const created = apiConfigCache.custom_providers.at(-1);
    renderApiConfig(created?.id || selectedProviderId);
    if (status) status.textContent = "已新建自定义 provider；编号会自动补空位。";
  } catch (error) {
    if (status) status.textContent = `新建失败：${error.message}`;
  }
}

function deleteSelectedCustomProvider() {
  const status = document.getElementById("apiConfigStatus");
  syncSelectedProviderToCache();
  const provider = findConfigProvider(selectedProviderId);
  if (!apiConfigCache || !isCustomProvider(provider)) {
    if (status) status.textContent = "OA/GG 是内置门牌，不能删除。";
    return;
  }
  apiConfigCache.custom_providers = apiConfigCache.custom_providers.filter((item) => item.id !== selectedProviderId);
  if (apiConfigCache.room_routes.linxu === selectedProviderId) {
    apiConfigCache.room_routes.linxu = "oa";
  }
  if (apiConfigCache.room_routes.dengdeng === selectedProviderId) {
    apiConfigCache.room_routes.dengdeng = "gg";
  }
  renderApiConfig("oa");
  if (status) status.textContent = "已从页面移除这个自定义 provider；点击保存后写入 D 盘。";
}

async function probeAimasConnector() {
  const status = document.getElementById("aimasProbeStatus");
  const configStatus = document.getElementById("apiConfigStatus");
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：请用 start-stillgarden.bat 打开后再测试。";
    return;
  }
  if (status) status.textContent = "正在保存并测试 Aimas / Hermes...";
  try {
    const saved = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(saved.config);
    const aimasApiKey = document.getElementById("aimasApiKey");
    const typedKey = aimasApiKey?.value || "";
    if (aimasApiKey) {
      aimasApiKey.value = "";
    }
    renderApiConfig(selectedProviderId);
    if (configStatus) {
      configStatus.textContent = "Aimas 配置已保存，正在做 Hermes 探针。";
    }

    const data = await appApi.probeAimas({
      endpoint: document.getElementById("aimasEndpoint")?.value || "",
      api_key: typedKey
    });
    const models = data.models?.items?.length ? data.models.items.join(", ") : "未返回模型列表";
    if (data.ok) {
      if (status) {
        status.textContent = `连接成功：health ${data.health?.status}，models ${data.models?.status}。模型：${models}`;
      }
    } else {
      if (status) {
        status.textContent =
          `探针未通过：health ${data.health?.status || "?"}，models ${data.models?.status || "?"}。` +
          ` ${data.message || "请检查 endpoint、端口或 API_SERVER_KEY。"}`;
      }
    }
  } catch (error) {
    if (status) status.textContent = `Aimas / Hermes 测试失败：${error.message}`;
  }
}

async function renameCurrentRoom() {
  const room = selectedChatRoom || "linxu";
  const current = roomLabels[room] || chatProfiles[room]?.name || room;
  const next = await openAppDialog({
    kicker: "PROFILE",
    title: "给这个房间改个备注",
    message: "备注只影响显示名，不会改变内部 room id 和记忆隔离。",
    input: true,
    value: current,
    cancelText: "先不改",
    confirmText: "保存备注"
  });
  if (next === null) {
    return;
  }
  const clean = next.trim();
  if (!clean) {
    showChatToast("备注不能为空。", "warning", 2200);
    return;
  }
  roomLabels[room] = clean.slice(0, 40);
  applyRoomLabels(roomLabels);
  updateConversationPreview(room);
  renderProfileSheet(room);
  if (!serviceOnline) {
    showChatToast("备注已改在当前浏览器；连接本地服务后再写入 D 盘。", "warning", 2600);
    return;
  }
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    renderApiConfig(selectedProviderId);
    showChatToast("备注已保存。", "success", 1800);
  } catch (error) {
    showChatToast(`备注暂未写入 D 盘：${error.message}`, "warning", 3000);
  }
}

function initSettingsController() {
  document.getElementById("apiConfigSave")?.addEventListener("click", saveApiConfig);
  document.getElementById("selfAccessMaster")?.addEventListener("click", (event) => {
    const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
    document.querySelectorAll(".self-access-reader").forEach((input) => {
      input.setAttribute("aria-pressed", next ? "true" : "false");
      input.classList.toggle("is-on", next);
    });
    saveSelfAccessConfig();
  });
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    input.addEventListener("click", (event) => {
      const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
      event.currentTarget.classList.toggle("is-on", next);
      const anyReader = Array.from(document.querySelectorAll(".self-access-reader"))
        .some((item) => item.getAttribute("aria-pressed") === "true");
      const master = document.getElementById("selfAccessMaster");
      if (master) {
        master.setAttribute("aria-pressed", anyReader ? "true" : "false");
      }
      saveSelfAccessConfig();
    });
  });
  document.getElementById("momentAutoCommentMaster")?.addEventListener("click", (event) => {
    const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
    document.querySelectorAll(".moment-auto-reader").forEach((input) => {
      input.setAttribute("aria-pressed", next ? "true" : "false");
      input.classList.toggle("is-on", next);
    });
    saveMomentsAutoCommentsConfig();
  });
  document.querySelectorAll(".moment-auto-reader").forEach((input) => {
    input.addEventListener("click", (event) => {
      const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
      event.currentTarget.classList.toggle("is-on", next);
      const anyReader = Array.from(document.querySelectorAll(".moment-auto-reader"))
        .some((item) => item.getAttribute("aria-pressed") === "true");
      const master = document.getElementById("momentAutoCommentMaster");
      if (master) {
        master.setAttribute("aria-pressed", anyReader ? "true" : "false");
      }
      saveMomentsAutoCommentsConfig();
    });
  });
  ["momentAutoCooldown", "momentAutoQuietStart", "momentAutoQuietEnd"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", saveMomentsAutoCommentsConfig);
  });
  document.getElementById("momentAutoPreviewButton")?.addEventListener("click", previewMomentsAutoComments);
  document.getElementById("momentAutoPreview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-moment-auto-run]");
    if (!button) {
      return;
    }
    runMomentsAutoCandidate(button.dataset.momentAutoRun || "", button.dataset.momentAutoCommenter || "");
  });
  document.getElementById("customProviderAdd")?.addEventListener("click", createCustomProvider);
  document.getElementById("customProviderDelete")?.addEventListener("click", deleteSelectedCustomProvider);
  document.getElementById("aimasProbeButton")?.addEventListener("click", probeAimasConnector);
  document.getElementById("renameRoomButton")?.addEventListener("click", renameCurrentRoom);
  document.getElementById("providerSelect")?.addEventListener("change", (event) => {
    syncSelectedProviderToCache();
    selectedProviderId = event.target.value;
    renderSelectedProvider();
  });

  document.getElementById("linxuProviderRoute")?.addEventListener("change", (event) => {
    if (apiConfigCache?.room_routes) {
      apiConfigCache.room_routes.linxu = event.target.value;
    }
  });

  document.getElementById("dengdengProviderRoute")?.addEventListener("change", (event) => {
    if (apiConfigCache?.room_routes) {
      apiConfigCache.room_routes.dengdeng = event.target.value;
    }
  });

}

