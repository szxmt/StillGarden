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
