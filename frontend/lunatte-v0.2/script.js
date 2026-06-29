const residentCopy = {
  linxu: "林絮默认读取 GPT/Alice 私有档案和 shared，不读取噔噔的私有记忆。",
  dengdeng: "噔噔默认读取 Gemini 私有档案和 shared；四月后内容会被标记为边界观察。",
  aimas: "Aimas 先作为未来住户留门牌：Hermes 终端智能体，本体接入待定，暂时不读取旧记忆库。"
};

const rooms = {
  linxu: {
    label: "LINXU ROOM",
    title: "把声音放低一点",
    body: "读取：Alice / 林絮核心人格、12 月补档、shared。禁止读取噔噔私有档案。",
    query: "人格和边界"
  },
  dengdeng: {
    label: "DENGDENG ROOM",
    title: "日常可以热闹，边界也要亮着",
    body: "读取：Gemini / 噔噔活动摘要、四月前核心、四月后边界观察。禁止读取林絮私有档案。",
    query: "记忆库 四月后"
  },
  living: {
    label: "LIVING ROOM",
    title: "客厅只放公共物品",
    body: "读取：shared 与用户明确允许带入的片段。这里可以一人两机，但不自动混线。",
    query: "公共边界"
  },
  aimas: {
    label: "AIMAS TERMINAL",
    title: "Aimas 的小窝先亮一盏灯",
    body: "Hermes / Aimas 未来可以作为第三位住户接入。现在不读取 Alice、噔噔或 self 的旧记忆，只保留一间可爱的小窝。",
    query: "Aimas 接入规则"
  }
};

let selectedRoom = "linxu";
let selectedChatRoom = "linxu";
let serviceOnline = false;
let serviceHeartbeatTimer = null;
let chatToastTimer = null;
let chatSearchTimer = null;
let chatSearchRunId = 0;
let apiConfigLoaded = false;
let apiConfigCache = null;
let selectedProviderId = "oa";
const wakePageSize = 5;
let wakeInboxEntries = [];
let wakeInboxPage = 1;
let currentMemoryCandidateId = "";
let timelineEntries = [];
let currentTimelinePerson = "all";
let currentTimelineSource = "all";
let timelinePage = 1;
const timelinePageSize = 5;

const defaultApiConfig = {
  api_mode: "live_if_configured",
  room_labels: {
    linxu: "林絮",
    dengdeng: "噔噔",
    aimas: "Aimas 的小窝",
    living: "客厅群聊"
  },
  room_routes: {
    linxu: "oa",
    dengdeng: "gg",
    living: "shared",
    aimas: "agent:aimas"
  },
  providers: {
    oa: {
      id: "oa",
      name: "OA / OpenAI",
      kind: "built_in",
      provider: "openai",
      base_url: "https://api.openai.com/v1",
      model: "未设置",
      key_alias: "",
      key_saved: false
    },
    gg: {
      id: "gg",
      name: "GG / Gemini",
      kind: "built_in",
      provider: "gemini",
      base_url: "https://generativelanguage.googleapis.com/v1beta",
      model: "未设置",
      key_alias: "",
      key_saved: false
    }
  },
  custom_providers: [],
  agent_connectors: {
    aimas: {
      endpoint: "",
      model: "hermes-agent",
      status: "planned",
      key_saved: false
    }
  },
  self_access: {
    enabled: false,
    readers: {
      linxu: false,
      dengdeng: false,
      aimas: false
    }
  },
  moments_auto_comments: {
    enabled: false,
    commenters: {
      linxu: false,
      dengdeng: false,
      aimas: false
    },
    cooldown_minutes: 120,
    quiet_start: "23:30",
    quiet_end: "09:00"
  },
  user_profile: {
    nickname: "小宝"
  },
  key_saved: false
};

const roomLabels = {
  linxu: "林絮",
  dengdeng: "噔噔",
  aimas: "Aimas 的小窝",
  living: "客厅群聊"
};

const memoryScopeLabels = {
  room: "当前关系可读",
  shared: "客厅 shared 可读",
  self: "只给自己看"
};

const selfReaderLabels = {
  linxu: "林絮",
  dengdeng: "噔噔",
  aimas: "Aimas"
};

const momentAutoReaderLabels = {
  linxu: "林絮",
  dengdeng: "噔噔",
  aimas: "Aimas"
};

const memoryImportanceLabels = {
  1: "很轻",
  2: "有一点",
  3: "普通",
  4: "重要",
  5: "非常重要"
};

const autoWakeReasons = {
  linxu: "安静想确认你有没有好好休息",
  dengdeng: "想听今天发生的小事",
  aimas: "小灯亮了一下，确认你需不需要我",
  living: "想把客厅桌面轻轻整理一下"
};

const autoWakeOrder = ["linxu", "dengdeng", "aimas", "living"];

const momentAuthors = {
  me: "小宝",
  linxu: "林絮",
  dengdeng: "噔噔",
  aimas: "Aimas",
  living: "客厅"
};

let pendingMomentImage = "";
let currentMomentScope = "all";
let latestMomentEntries = [];
let latestMomentSignature = "";
let pendingChatMoment = null;
let appDialogResolver = null;
let commentPressTimer = null;
let commentLongPressHandled = false;
let activeMomentComment = null;
let momentTouchStartY = null;
let profileReturnTarget = "chat";
let serverProfileAssets = {};
let profileAssetsLoaded = false;
let profileAssetsSignature = "";

const chatProfiles = {
  linxu: {
    name: "林絮",
    boundary: "只读取林絮房间和 shared。",
    hello: "我在。先把声音放低一点，我们慢慢说。",
    system: "当前：林絮房间。不会读取噔噔私有记忆，也不会读取 self。",
    preview: "低声房间 · 独立 session"
  },
  dengdeng: {
    name: "噔噔",
    boundary: "只读取噔噔房间和 shared。",
    hello: "噔噔探头。今天的小事也可以放进来。",
    system: "当前：噔噔房间。四月后内容只作为边界观察，不读取林絮私有记忆。",
    preview: "日常房间 · 独立 session"
  },
  aimas: {
    name: "Aimas",
    boundary: "Aimas 的小窝暂不读取旧记忆。",
    hello: "Aimas 的小窝已挂牌。Hermes 本体还没接，但灯先亮着。",
    system: "当前：Aimas 的小窝。不会读取 Alice/林絮、噔噔或 self 的旧记忆。",
    preview: "Hermes 待接入 · 独立 session"
  },
  living: {
    name: "客厅群聊",
    boundary: "只读取 shared，可作为一人多机的公共房间。",
    hello: "客厅灯开着。这里可以把要共同知道的话放在桌上。",
    system: "当前：客厅群聊。只读取 shared，不自动带入林絮、噔噔、Aimas 的私有记忆。",
    preview: "一人多机 · shared only",
    group: "group",
    order: 4
  }
};

chatProfiles.linxu.group = "single";
chatProfiles.linxu.order = 1;
chatProfiles.dengdeng.group = "single";
chatProfiles.dengdeng.order = 2;
chatProfiles.aimas.group = "single";
chatProfiles.aimas.order = 3;

function formatNumber(value) {
  if (typeof value !== "number") {
    return "...";
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

async function loadHomeStats() {
  const status = document.getElementById("homeStatus");
  try {
    const response = await fetch("/api/stats");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    document.getElementById("statGptChats").textContent = formatNumber(data.gpt_conversations);
    document.getElementById("statGeminiCards").textContent = formatNumber(data.gemini_activities);
    document.getElementById("statSupplements").textContent = formatNumber(data.incoming_supplements);
    document.getElementById("statResidents").textContent = formatNumber(data.residents);
    status.innerHTML = `
      <span>LOCAL INDEX</span>
      <p>
        关系节点：${formatNumber(data.relationship_nodes)} 条；
        日常索引：${formatNumber(data.daily_entries)} 条；
        人格证据：${formatNumber(data.persona_evidence)} 条。
        Aimas：${data.aimas_status}
      </p>
    `;
  } catch (error) {
    status.innerHTML = `
      <span>STATIC MODE</span>
      <p>现在是静态页面。双击 start-stillgarden.bat 后，Home 会读取 D 盘记忆库的真实统计。</p>
    `;
  }
}

async function loadServiceStatus() {
  const status = document.getElementById("serviceStatus");
  if (!status) {
    return;
  }
  const label = status.querySelector("b") || status;
  if (window.location.protocol === "file:") {
    serviceOnline = false;
    label.textContent = "未连接";
    status.title = "静态预览：当前是直接打开文件，只会保存到这个浏览器。请用 start-stillgarden.bat 打开的网页来写入 D 盘。";
    status.className = "service-pill offline";
    return;
  }
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    serviceOnline = Boolean(data.ok);
    label.textContent = serviceOnline ? "已连接" : "未连接";
    const started = data.started_at ? `；启动于 ${formatSessionTime(data.started_at)}` : "";
    const pid = data.pid ? `；PID ${data.pid}` : "";
    status.title = serviceOnline
      ? `本地服务已连接：草稿会写入 ${data.sessions}${started}${pid}`
      : data.message || "本地服务状态异常。";
    status.className = serviceOnline ? "service-pill online" : "service-pill offline";
    if (serviceOnline && !apiConfigLoaded) {
      loadApiConfig();
    }
    if (serviceOnline && !profileAssetsLoaded) {
      loadProfileAssets();
    }
    if (serviceOnline) {
      loadWakeInbox();
      loadMoments({ background: true });
      loadConfirmedMemory();
    }
  } catch (error) {
    serviceOnline = false;
    label.textContent = "未连接";
    status.title = `静态预览：还没有连上本地服务，只会保存到这个浏览器。原因：${error.message}`;
    status.className = "service-pill offline";
  }
}

function startServiceHeartbeat() {
  loadServiceStatus();
  if (serviceHeartbeatTimer) {
    window.clearInterval(serviceHeartbeatTimer);
  }
  serviceHeartbeatTimer = window.setInterval(loadServiceStatus, 3000);
}

function resultMeta(item) {
  const bits = [];
  if (item.source_index) bits.push(item.source_index);
  if (item.date) bits.push(item.date);
  if (item.phase) bits.push(item.phase);
  if (item.flags?.length) bits.push(`标记：${item.flags.join(", ")}`);
  return bits.join(" · ") || "索引结果";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSessionTime(value) {
  if (!value) {
    return "--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  if (sameDay) {
    return `今天 ${time}`;
  }
  const day = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  return `${day} ${time}`;
}

function formatConversationTime(value) {
  if (!value) {
    return "--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function resizeChatDraftInput() {
  const input = document.getElementById("chatDraft");
  if (!input) {
    return;
  }
  input.style.height = "auto";
  const maxHeight = 138;
  const nextHeight = Math.min(input.scrollHeight, maxHeight);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
}

async function fetchSessionLog(room, limit = 8, query = "") {
  const params = new URLSearchParams({
    room,
    limit: String(limit)
  });
  if (query) {
    params.set("query", query);
  }
  const response = await fetch(`/api/session-log?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function saveSessionMessage(room, text) {
  if (!serviceOnline) {
    throw new Error("local service offline");
  }
  const response = await fetch("/api/session-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ room, text: text.text || text, client_id: text.client_id })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function buildChatPackage(room, draftRecord) {
  if (!serviceOnline) {
    throw new Error("local service offline");
  }
  const response = await fetch("/api/chat-package", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ room, text: draftRecord.text, client_id: draftRecord.client_id })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function callAimasAgent(draftRecord) {
  if (!serviceOnline) {
    throw new Error("local service offline");
  }
  const response = await fetch("/api/aimas-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: draftRecord.text, client_id: draftRecord.client_id })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function callProviderModel(room, draftRecord) {
  if (!serviceOnline) {
    throw new Error("local service offline");
  }
  const response = await fetch("/api/provider-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ room, text: draftRecord.text, client_id: draftRecord.client_id })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

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
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    renderApiConfig(selectedProviderId);
    if (status) status.textContent = "self 可读范围已保存。";
  } catch (error) {
    if (status) status.textContent = `self 开关保存失败：${error.message}`;
  }
}

function normalizeApiConfig(config = {}) {
  const builtIns = config.providers || {};
  const selfAccess = normalizeSelfAccess(config.self_access || defaultApiConfig.self_access);
  const momentsAutoComments = normalizeMomentsAutoComments(config.moments_auto_comments || defaultApiConfig.moments_auto_comments);
  const userProfile = normalizeUserProfile(config.user_profile || defaultApiConfig.user_profile);
  return {
    ...defaultApiConfig,
    ...config,
    room_labels: {
      ...defaultApiConfig.room_labels,
      ...(config.room_labels || {})
    },
    room_routes: {
      ...defaultApiConfig.room_routes,
      ...(config.room_routes || {})
    },
    providers: {
      oa: {
        ...defaultApiConfig.providers.oa,
        ...(builtIns.oa || {})
      },
      gg: {
        ...defaultApiConfig.providers.gg,
        ...(builtIns.gg || {})
      }
    },
    custom_providers: Array.isArray(config.custom_providers)
      ? config.custom_providers.map((item, index) => ({
          id: item.id || `custom-local-${index + 1}`,
          name: item.name || `自定义${index + 1}`,
          kind: "custom",
          provider: "custom",
          base_url: item.base_url || "",
          model: item.model || "未设置",
          key_alias: item.key_alias || "",
          key_saved: Boolean(item.key_saved)
        }))
      : [],
    agent_connectors: {
      aimas: {
        ...defaultApiConfig.agent_connectors.aimas,
        ...(config.agent_connectors?.aimas || {})
      }
    },
    self_access: selfAccess,
    moments_auto_comments: momentsAutoComments,
    user_profile: userProfile
  };
}

function normalizeUserProfile(value = {}) {
  const nickname = String(value.nickname || defaultApiConfig.user_profile.nickname || "小宝").trim().slice(0, 20);
  return {
    nickname: nickname || "小宝"
  };
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

function normalizeSelfAccess(value = {}) {
  const incomingReaders = value.readers || {};
  const readers = {
    linxu: Boolean(incomingReaders.linxu),
    dengdeng: Boolean(incomingReaders.dengdeng),
    aimas: Boolean(incomingReaders.aimas)
  };
  const anyReader = Object.values(readers).some(Boolean);
  return {
    enabled: Boolean(value.enabled) && anyReader,
    readers: anyReader ? readers : { linxu: false, dengdeng: false, aimas: false }
  };
}

function normalizeMomentsAutoComments(value = {}) {
  const incomingCommenters = value.commenters || {};
  const commenters = {
    linxu: Boolean(incomingCommenters.linxu),
    dengdeng: Boolean(incomingCommenters.dengdeng),
    aimas: Boolean(incomingCommenters.aimas)
  };
  const anyCommenter = Object.values(commenters).some(Boolean);
  const cooldown = Number.parseInt(value.cooldown_minutes, 10);
  const safeCooldown = Number.isFinite(cooldown) ? Math.min(1440, Math.max(15, cooldown)) : 120;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const quietStart = timePattern.test(String(value.quiet_start || "")) ? value.quiet_start : "23:30";
  const quietEnd = timePattern.test(String(value.quiet_end || "")) ? value.quiet_end : "09:00";
  return {
    enabled: Boolean(value.enabled) && anyCommenter,
    commenters: anyCommenter ? commenters : { linxu: false, dengdeng: false, aimas: false },
    cooldown_minutes: safeCooldown,
    quiet_start: quietStart,
    quiet_end: quietEnd
  };
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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
    const response = await fetch("/api/moment-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: momentId, action: "auto_comment", author: safeCommenter })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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
    const response = await fetch("/api/moments-auto-preview");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        create_custom_provider: true,
        ...collectApiConfigForSave()
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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
    const saveResponse = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    if (!saveResponse.ok) {
      throw new Error(`保存失败 HTTP ${saveResponse.status}`);
    }
    const saved = await saveResponse.json();
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

    const probeResponse = await fetch("/api/aimas-probe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        endpoint: document.getElementById("aimasEndpoint")?.value || "",
        api_key: typedKey
      })
    });
    const data = await probeResponse.json();
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    apiConfigCache = normalizeApiConfig(data.config);
    renderApiConfig(selectedProviderId);
    showChatToast("备注已保存。", "success", 1800);
  } catch (error) {
    showChatToast(`备注暂未写入 D 盘：${error.message}`, "warning", 3000);
  }
}

function browserDraftKey(room) {
  return `stillgarden.session.${room}.drafts`;
}

function makeDraftRecord(room, text, role = "user") {
  return {
    client_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    room,
    role,
    text,
    status: "draft_browser_cache",
    archive_write: false
  };
}

function readBrowserDrafts(room) {
  try {
    const raw = window.localStorage.getItem(browserDraftKey(room));
    const entries = JSON.parse(raw || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    return [];
  }
}

function chatPrefsKey() {
  return "stillgarden.chat.preferences";
}

function readChatPrefs() {
  try {
    const value = JSON.parse(window.localStorage.getItem(chatPrefsKey()) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    return {};
  }
}

function writeChatPrefs(prefs) {
  try {
    window.localStorage.setItem(chatPrefsKey(), JSON.stringify(prefs || {}));
  } catch (error) {
    showChatToast("这个浏览器没有存下聊天设置。", "warning", 2200);
  }
}

function chatPrefsFor(room) {
  return readChatPrefs()[room] || {};
}

function updateChatPrefs(room, patch) {
  const safeRoom = chatProfiles[room] ? room : "linxu";
  const prefs = readChatPrefs();
  prefs[safeRoom] = {
    ...(prefs[safeRoom] || {}),
    ...patch
  };
  writeChatPrefs(prefs);
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
  const record = makeDraftRecord(room, text);
  return writeBrowserEntry(room, record);
}

function writeBrowserEntry(room, record) {
  const entries = [...readBrowserDrafts(room), record].slice(-60);
  try {
    window.localStorage.setItem(browserDraftKey(room), JSON.stringify(entries));
  } catch (error) {
    // The visible bubble still remains in the current page if storage is unavailable.
  }
  return record;
}

function mergeDraftEntriesWithLimit(limit, ...groups) {
  const seen = new Set();
  return groups
    .flat()
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.client_id || `${entry.room || ""}|${entry.timestamp || ""}|${entry.text || ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0))
    .slice(-limit);
}

function mergeDraftEntries(...groups) {
  return mergeDraftEntriesWithLimit(12, ...groups);
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

function activatePanel(panelName) {
  closeAllSubpages();
  closeProfileSheet({ restore: false });
  closeChatInfoSheet();
  document.getElementById("chatWindow")?.classList.remove("detail-open");
  document.querySelector(".phone-shell")?.classList.remove("chat-focus", "subpage-focus");
  document.querySelectorAll(".dock-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.target === panelName);
  });
  document.querySelectorAll(".app-page").forEach((page) => page.classList.remove("active-page"));
  const target = document.querySelector(`[data-panel="${panelName}"]`);
  if (target) {
    target.classList.add("active-page");
    window.scrollTo({ top: 0, behavior: "smooth" });
    panelDidOpen(panelName);
  }
}

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
  return "stillgarden.profile.assets";
}

function readProfileAssets() {
  try {
    const value = JSON.parse(window.localStorage.getItem(profileAssetsKey()) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    return {};
  }
}

function writeProfileAssets(assets) {
  try {
    window.localStorage.setItem(profileAssetsKey(), JSON.stringify(assets || {}));
  } catch (error) {
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
    const response = await fetch("/api/profile-assets");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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

function ensureSubpageAppbar(card, panel) {
  let bar = card.querySelector(":scope > .subpage-appbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "subpage-appbar";
    const button = document.createElement("button");
    button.className = "subpage-back";
    button.type = "button";
    button.textContent = "‹";
    button.setAttribute("aria-label", "返回");
    button.addEventListener("click", () => {
      if (card.querySelector("#momentsPanel.active-subpage.is-composing")) {
        closeMomentComposer();
        return;
      }
      if (card.querySelector("#momentsPanel.active-subpage") && currentMomentScope !== "all") {
        setMomentScope("all");
        return;
      }
      closeSubpage(card);
    });
    const title = document.createElement("span");
    title.className = "subpage-title";
    bar.append(button, title);
    card.appendChild(bar);
  }
  const isMomentsPanel = panel?.id === "momentsPanel";
  bar.classList.toggle("moment-subpage-appbar", isMomentsPanel);
  const button = bar.querySelector(".subpage-back");
  if (button) {
    button.innerHTML = isMomentsPanel
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.6 8.4 12l6.4 6.4"/></svg>`
      : "‹";
  }
  const title = bar.querySelector(".subpage-title");
  if (title) {
    title.textContent = panel?.dataset?.subpageTitle || "详情";
  }
  return bar;
}

function closeSubpage(card) {
  if (!card) {
    return;
  }
  const wasMomentsPanel = Boolean(card.querySelector("#momentsPanel.active-subpage"));
  if (wasMomentsPanel) {
    closeMomentComposer();
    activeMomentComment = null;
  }
  card.classList.remove("subpage-open");
  document.querySelector(".phone-shell")?.classList.remove("subpage-focus");
  card.querySelectorAll(".active-subpage").forEach((panel) => {
    panel.classList.remove("active-subpage");
    if (panel.matches("details")) {
      panel.removeAttribute("open");
    }
  });
  if (wasMomentsPanel) {
    setMomentScope("all");
  }
}

function closeAllSubpages() {
  document.querySelectorAll(".phone-card.subpage-open").forEach((card) => closeSubpage(card));
}

function panelDidOpen(panelName) {
  if (panelName === "timeline") {
    loadTimeline();
  }
}

function openSubpage(targetId) {
  const panel = document.getElementById(targetId);
  if (!panel) {
    return;
  }
  const card = panel.closest(".phone-card");
  if (!card) {
    return;
  }
  closeSubpage(card);
  ensureSubpageAppbar(card, panel);
  document.querySelector(".phone-shell")?.classList.add("subpage-focus");
  card.classList.add("subpage-open");
  panel.classList.add("active-subpage");
  if (panel.matches("details")) {
    panel.setAttribute("open", "");
  }
  if (targetId === "myProfilePanel") {
    renderMyProfilePanel();
  }
  panel.scrollTop = 0;
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

function showChatToast(message, kind = "info", holdMs = 2200) {
  const toast = document.getElementById("chatToast");
  if (!toast) {
    return;
  }
  window.clearTimeout(chatToastTimer);
  toast.textContent = message;
  toast.className = `chat-toast show ${kind}`;
  chatToastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, holdMs);
}

function closeAppDialog(result = null) {
  const sheet = document.getElementById("appDialogSheet");
  sheet?.setAttribute("hidden", "");
  if (appDialogResolver) {
    appDialogResolver(result);
    appDialogResolver = null;
  }
}

function openAppDialog({
  kicker = "STILLGARDEN",
  title = "确认一下",
  message = "",
  input = false,
  value = "",
  placeholder = "",
  cancelText = "取消",
  confirmText = "确认"
} = {}) {
  const sheet = document.getElementById("appDialogSheet");
  const inputNode = document.getElementById("appDialogInput");
  if (!sheet || !inputNode) {
    return Promise.resolve(null);
  }
  if (appDialogResolver) {
    closeAppDialog(null);
  }
  document.getElementById("appDialogKicker").textContent = kicker;
  document.getElementById("appDialogTitle").textContent = title;
  document.getElementById("appDialogMessage").textContent = message;
  document.getElementById("appDialogCancel").textContent = cancelText;
  document.getElementById("appDialogConfirm").textContent = confirmText;
  inputNode.hidden = !input;
  inputNode.value = value;
  inputNode.placeholder = placeholder;
  sheet.removeAttribute("hidden");
  if (input) {
    window.setTimeout(() => {
      inputNode.focus();
      inputNode.select();
    }, 30);
  }
  return new Promise((resolve) => {
    appDialogResolver = resolve;
  });
}

function formatWakeText(room, label, reason) {
  if (room === "linxu") {
    return "刚刚想到你，想问问你现在还好吗。";
  }
  if (room === "dengdeng") {
    return "今天有没有什么小事想讲给我听？";
  }
  if (room === "aimas") {
    return "我在这里，等你需要我的时候再展开。";
  }
  return "客厅灯开着。如果想让大家一起知道，可以把这件事放到这里。";
}

function showWakeNotice(message) {
  const notice = document.getElementById("wakeNotice");
  if (!notice) {
    return;
  }
  notice.textContent = message || "";
}

function momentBrowserKey() {
  return "stillgarden.moments.feed";
}

function momentDraftKey() {
  return "stillgarden.moments.draft";
}

function momentAvatarMeta(author) {
  const meta = {
    me: { text: "我", className: "moon", title: "我的圈圈" },
    linxu: { text: "林", className: "moon", title: "林絮的圈圈" },
    dengdeng: { text: "噔", className: "sun", title: "噔噔的圈圈" },
    aimas: { text: "A", className: "terminal", title: "Aimas 的圈圈" },
    living: { text: "厅", className: "living", title: "客厅圈圈" }
  };
  return meta[author] || meta.me;
}

function setMomentScope(author = "all") {
  closeMomentComposer();
  activeMomentComment = null;
  currentMomentScope = author;
  renderMoments();
}

function updateMomentHero() {
  const title = document.getElementById("momentHeroTitle");
  const avatar = document.getElementById("momentHeroAvatar");
  const hero = document.querySelector(".moment-hero");
  const allButton = document.getElementById("momentAllButton");
  const isAll = currentMomentScope === "all";
  const heroAuthor = isAll ? "me" : currentMomentScope;
  const meta = momentAvatarMeta(heroAuthor);
  const assets = profileAssetFor(heroAuthor);
  const heroBackground = assets.moment_background || assets.background;
  if (title) {
    title.textContent = isAll ? "我的圈圈" : meta.title;
  }
  if (avatar) {
    setAvatarNode(avatar, heroAuthor);
  }
  if (hero) {
    hero.style.backgroundImage = heroBackground ? `url("${heroBackground}")` : "";
    hero.classList.toggle("has-image", Boolean(heroBackground));
  }
  if (allButton) {
    allButton.hidden = true;
  }
}

function momentAutoText(author, reason) {
  const cleanReason = reason || "刚刚聊天时想到的小事";
  if (author === "linxu") {
    return `把这件事先放在这里：${cleanReason}。不用说得很响，记得就好。`;
  }
  if (author === "dengdeng") {
    return `今日小发现：${cleanReason}。噔噔先盖个小章，之后再回来补充！`;
  }
  if (author === "aimas") {
    return `Aimas 小灯记录：${cleanReason}。终端还亮着，我会把这条线索留好。`;
  }
  if (author === "living") {
    return `客厅留条公共便签：${cleanReason}。谁路过都可以接一句。`;
  }
  return cleanReason;
}

function momentAutoComment(author, entry) {
  const text = String(entry?.text || "这条圈圈");
  const shortText = text.length > 18 ? `${text.slice(0, 18)}...` : text;
  if (author === "linxu") {
    return `我看见了。${shortText}，先轻轻放在这里。`;
  }
  if (author === "dengdeng") {
    return `噔噔来评论！这条我记下啦：${shortText}`;
  }
  if (author === "aimas") {
    return `Aimas 收到这条信号：${shortText}`;
  }
  if (author === "living") {
    return `客厅路过，给这条留一盏灯。`;
  }
  return `我也在这里。`;
}

function renderMomentAutoCommentButtons(entry = {}) {
  return ["linxu", "dengdeng", "aimas"]
    .map((author) => `
      <button type="button" data-moment-action="auto_comment" data-moment-id="${escapeHtml(entry.id || "")}" data-moment-commenter="${author}">
        ${escapeHtml(momentAuthors[author])}回一句
      </button>
    `)
    .join("");
}

function readBrowserMoments() {
  try {
    const entries = JSON.parse(window.localStorage.getItem(momentBrowserKey()) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    return [];
  }
}

function writeBrowserMoments(entries) {
  try {
    window.localStorage.setItem(momentBrowserKey(), JSON.stringify(entries.slice(0, 200)));
  } catch (error) {
    // Current page still renders the in-memory list.
  }
}

function readMomentDraft() {
  try {
    const draft = JSON.parse(window.localStorage.getItem(momentDraftKey()) || "{}");
    return draft && typeof draft === "object" ? draft : {};
  } catch (error) {
    return {};
  }
}

function writeMomentDraft() {
  const draft = {
    author: document.getElementById("momentAuthor")?.value || "me",
    text: document.getElementById("momentText")?.value || "",
    reason: document.getElementById("momentReason")?.value || "",
    image_data: pendingMomentImage || "",
    saved_at: new Date().toISOString()
  };
  try {
    window.localStorage.setItem(momentDraftKey(), JSON.stringify(draft));
  } catch (error) {
    const status = document.getElementById("momentStatus");
    if (status) status.textContent = "草稿文字还在页面里，但图片太大，浏览器没有存下。";
  }
}

function restoreMomentDraft() {
  const draft = readMomentDraft();
  const author = document.getElementById("momentAuthor");
  const text = document.getElementById("momentText");
  const reason = document.getElementById("momentReason");
  if (author && draft.author) author.value = momentAuthors[draft.author] ? draft.author : "me";
  if (text) text.value = draft.text || "";
  if (reason) reason.value = draft.reason || "刚刚聊天时想到的小事";
  pendingMomentImage = draft.image_data || "";
  renderMomentImagePreview();
}

function clearMomentDraft() {
  try {
    window.localStorage.removeItem(momentDraftKey());
  } catch (error) {
    // Clearing draft is best-effort only.
  }
}

function createBrowserMoment(author, text, source = "manual", reason = "", imageData = "") {
  const post = {
    id: `moment-browser-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    author,
    author_label: momentDisplayName(author),
    text,
    image_data: imageData,
    source,
    reason,
    likes: [],
    comments: []
  };
  const entries = [post, ...readBrowserMoments()];
  writeBrowserMoments(entries);
  return entries;
}

function updateBrowserMoment(id, action, text = "", author = "me", replyTo = "") {
  const entries = readBrowserMoments().map((entry) => {
    if (entry.id !== id) {
      return entry;
    }
    if (action === "like") {
      const likes = entry.likes?.includes("你") ? entry.likes : [...(entry.likes || []), "你"];
      return { ...entry, likes };
    }
    if (action === "unlike") {
      return { ...entry, likes: (entry.likes || []).filter((name) => name !== "你") };
    }
    if (action === "comment") {
      const comment = {
        id: `comment-browser-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        author,
        author_label: momentDisplayName(author),
        text,
        reply_to: replyTo
      };
      return { ...entry, comments: [...(entry.comments || []), comment] };
    }
    if (action === "delete_comment") {
      return { ...entry, comments: (entry.comments || []).filter((comment) => comment.id !== text) };
    }
    return entry;
  }).filter((entry) => !(entry.id === id && action === "delete_post"));
  writeBrowserMoments(entries);
  return entries;
}

function renderMomentLikePills(likes = []) {
  if (!likes.length) {
    return "";
  }
  return `
    <div class="moment-likes">
      ${likes.map((name) => `
        <span class="moment-like-pill" title="${escapeHtml(name)} 点赞了">
          <i>${escapeHtml(String(name).slice(0, 1) || "♡")}</i>
        </span>
      `).join("")}
    </div>
  `;
}

function momentDisplayName(author, fallback = "") {
  if (author === "me") {
    return momentAuthors.me;
  }
  return fallback || momentAuthors[author] || "你";
}

function momentCommentParts(comment = {}) {
  let text = String(comment.text || "").trim();
  let replyTo = String(comment.reply_to || comment.replyTo || "").trim();
  if (!replyTo) {
    const legacyReply = text.match(/^回复(.{1,28}?)[：:]\s*(.*)$/s);
    if (legacyReply) {
      replyTo = legacyReply[1].trim();
      text = legacyReply[2].trim();
    }
  }
  return {
    author: momentDisplayName(comment.author, comment.author_label),
    replyTo,
    text
  };
}

function renderMomentCommentText(comment = {}) {
  const parts = momentCommentParts(comment);
  if (parts.replyTo) {
    return `<strong>${escapeHtml(parts.author)}</strong><em>回复</em><strong>${escapeHtml(parts.replyTo)}</strong><b>：</b>${escapeHtml(parts.text)}`;
  }
  return `<strong>${escapeHtml(parts.author)}：</strong>${escapeHtml(parts.text)}`;
}

function momentEntriesSignature(entries = latestMomentEntries) {
  return JSON.stringify((entries || []).map((entry) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    author: entry.author,
    text: entry.text,
    image: Boolean(entry.image_data || entry.image),
    likes: entry.likes || [],
    comments: (entry.comments || []).map((comment) => ({
      id: comment.id,
      author: comment.author,
      text: comment.text,
      reply_to: comment.reply_to || comment.replyTo || ""
    }))
  })));
}

function isMomentInteractionActive() {
  const active = document.activeElement;
  return Boolean(
    active?.closest?.(".moment-inline-comment, .moment-composer") ||
    document.querySelector(".moment-more-menu[open]") ||
    activeMomentComment
  );
}

function renderMoments(entries) {
  const feed = document.getElementById("momentsFeed");
  if (!feed) {
    return;
  }
  if (Array.isArray(entries)) {
    latestMomentEntries = entries;
    latestMomentSignature = momentEntriesSignature(entries);
  }
  updateMomentHero();
  const scopedEntries = currentMomentScope === "all"
    ? latestMomentEntries
    : latestMomentEntries.filter((entry) => entry.author === currentMomentScope);
  if (!scopedEntries.length) {
    const label = currentMomentScope === "all"
      ? "还没有圈圈。先发一条小纸页。"
      : `这里还没有${momentAvatarMeta(currentMomentScope).title}。`;
    feed.innerHTML = `<p class="config-status">${escapeHtml(label)}</p>`;
    return;
  }
  feed.innerHTML = scopedEntries.map((entry) => {
    const likes = Array.isArray(entry.likes) ? entry.likes : [];
    const comments = Array.isArray(entry.comments) ? entry.comments : [];
    const imageData = entry.image_data || entry.image || "";
    const likedByMe = likes.includes("你");
    const showDelete = currentMomentScope !== "all";
    const isCommenting = activeMomentComment?.id === entry.id;
    const commentValue = activeMomentComment?.text || "";
    const commentPlaceholder = activeMomentComment?.replyTo ? `回复${activeMomentComment.replyTo}` : "写一句评论。";
    return `
      <article class="moment-card">
        <button class="moment-avatar-button" type="button" data-moment-scope="${escapeHtml(entry.author || "me")}">
          ${renderAvatar(entry.author || "me")}
        </button>
        <div class="moment-body">
          <header>
            <strong>${escapeHtml(momentDisplayName(entry.author, entry.author_label))}</strong>
            <time>${escapeHtml(formatSessionTime(entry.timestamp))}</time>
          </header>
          <p>${escapeHtml(entry.text || "")}</p>
          ${imageData ? `<img class="moment-photo" src="${escapeHtml(imageData)}" alt="圈圈图片" />` : ""}
          ${renderMomentLikePills(likes)}
          ${comments.length ? `<div class="moment-comments">${comments.map((comment) => `
            <p data-comment-id="${escapeHtml(comment.id || "")}" data-comment-author="${escapeHtml(momentDisplayName(comment.author, comment.author_label))}" data-comment-text="${escapeHtml(comment.text || "")}" data-moment-id="${escapeHtml(entry.id || "")}" title="短按回复，长按删除">
              ${renderAvatar(comment.author || "me", "moment-comment-avatar")}
              <span>${renderMomentCommentText(comment)}</span>
            </p>
          `).join("")}</div>` : ""}
          ${isCommenting ? `
            <div class="moment-inline-comment">
              <textarea data-moment-comment-input="${escapeHtml(entry.id || "")}" rows="2" placeholder="${escapeHtml(commentPlaceholder)}">${escapeHtml(commentValue)}</textarea>
              <div>
                <button type="button" data-moment-comment-cancel="${escapeHtml(entry.id || "")}">收起</button>
                <button type="button" data-moment-comment-submit="${escapeHtml(entry.id || "")}">发评论</button>
              </div>
            </div>
          ` : ""}
          <div class="moment-card-footer">
            <details class="moment-more-menu">
              <summary aria-label="更多操作">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="6.8" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="17.2" cy="12" r="1.5"></circle>
                </svg>
              </summary>
              <div class="moment-more-popover">
                <button type="button" data-moment-action="${likedByMe ? "unlike" : "like"}" data-moment-id="${escapeHtml(entry.id || "")}">${likedByMe ? "取消赞" : "点赞"}</button>
                <button type="button" data-moment-action="comment" data-moment-id="${escapeHtml(entry.id || "")}">我评论</button>
                ${renderMomentAutoCommentButtons(entry)}
                ${showDelete ? `<button class="moment-delete-button" type="button" data-moment-action="delete_post" data-moment-id="${escapeHtml(entry.id || "")}">删除动态</button>` : ""}
              </div>
            </details>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function imageDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil(base64.length * 0.75);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("图片读取失败。")));
    image.src = dataUrl;
  });
}

async function compressImageDataUrl(dataUrl, options = {}) {
  const image = await loadImageFromDataUrl(dataUrl);
  const targetBytes = options.maxOutputBytes || 900_000;
  const edgeList = options.edgeList || [1600, 1280, 1024, 860, 720];
  const qualityList = options.qualityList || [0.82, 0.72, 0.62, 0.52, 0.42];
  let best = dataUrl;
  for (const maxEdge of edgeList) {
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      break;
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of qualityList) {
      const candidate = canvas.toDataURL("image/jpeg", quality);
      if (candidate && candidate.startsWith("data:image/")) {
        best = candidate;
        if (imageDataUrlBytes(candidate) <= targetBytes) {
          return {
            dataUrl: candidate,
            compressed: candidate !== dataUrl,
            bytes: imageDataUrlBytes(candidate)
          };
        }
      }
    }
  }
  return {
    dataUrl: best,
    compressed: best !== dataUrl,
    bytes: imageDataUrlBytes(best)
  };
}

function readImageFileAsDataUrl(file, callback, options = {}) {
  if (!file) {
    return;
  }
  const finalLimit = options.limitBytes || (options.serverAsset && serviceOnline ? 1_500_000 : 1_500_000);
  const sourceLimit = options.sourceLimitBytes || (options.serverAsset && serviceOnline ? 120_000_000 : finalLimit);
  if (file.size > sourceLimit) {
    const mb = Math.floor(sourceLimit / 1_000_000);
    showChatToast(`这张图太大啦，先选 ${mb}MB 以下的小图。`, "warning", 2600);
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    const original = String(reader.result || "");
    if (options.compress !== false && options.serverAsset && serviceOnline && file.type.startsWith("image/")) {
      try {
        const result = await compressImageDataUrl(original, {
          maxOutputBytes: options.maxOutputBytes || 1_800_000
        });
        callback(result.dataUrl, result);
        return;
      } catch (error) {
        showChatToast("自动压缩失败，先换一张小一点的图。", "warning", 2600);
        return;
      }
    }
    if (imageDataUrlBytes(original) > finalLimit) {
      const mb = Math.floor(finalLimit / 1_000_000);
      showChatToast(`这张图有点大，先选 ${mb}MB 以下的小图。`, "warning", 2600);
      return;
    }
    callback(original, { compressed: false, bytes: imageDataUrlBytes(original) });
  });
  reader.readAsDataURL(file);
}

async function prepareMomentImageForPost(status) {
  if (!pendingMomentImage || !pendingMomentImage.startsWith("data:image/")) {
    return pendingMomentImage || "";
  }
  const currentBytes = imageDataUrlBytes(pendingMomentImage);
  if (currentBytes <= 1_500_000) {
    return pendingMomentImage;
  }
  if (status) {
    status.textContent = "发布前再压一次图片，避免旧草稿把请求撑爆。";
  }
  const result = await compressImageDataUrl(pendingMomentImage, { maxOutputBytes: 900_000 });
  if (result.bytes > 2_500_000) {
    throw new Error("图片压缩后还是太大，先点右上角 × 移除，或换一张截图/小图。");
  }
  pendingMomentImage = result.dataUrl;
  renderMomentImagePreview();
  writeMomentDraft();
  return pendingMomentImage;
}

async function saveRoomAsset(room, kind, dataUrl) {
  const safeRoom = momentAuthors[room] ? room : "linxu";
  const assets = readProfileAssets();
  if (serviceOnline) {
    try {
      const response = await fetch("/api/profile-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: safeRoom, kind, data_url: dataUrl })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
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
      const response = await fetch("/api/profile-assets-clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, kinds: ["avatar", "background"] })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
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
    const response = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(collectApiConfigForSave())
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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
      const response = await fetch("/api/profile-assets-clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: "me", kinds: ["avatar", "background"] })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
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

async function loadMoments(options = {}) {
  if (!serviceOnline) {
    const entries = readBrowserMoments();
    const signature = momentEntriesSignature(entries);
    if (options.background && (signature === latestMomentSignature || isMomentInteractionActive())) {
      return;
    }
    renderMoments(entries);
    return;
  }
  try {
    const response = await fetch("/api/moments?limit=80");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    const entries = mergeMomentEntries(readBrowserMoments(), data.entries || []);
    const signature = momentEntriesSignature(entries);
    if (options.background && (signature === latestMomentSignature || isMomentInteractionActive())) {
      return;
    }
    renderMoments(entries);
  } catch (error) {
    const feed = document.getElementById("momentsFeed");
    if (feed) {
      feed.innerHTML = `<p class="config-status">圈圈读取失败：${escapeHtml(error.message)}</p>`;
    }
  }
}

function mergeMomentEntries(...groups) {
  const seen = new Set();
  return groups
    .flat()
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.id || `${entry.timestamp}|${entry.author}|${entry.text}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

function timelineTypeLabel(type = "") {
  return {
    chat_message: "聊天",
    moment_post: "圈圈",
    moment_comment: "评论",
    confirmed_memory: "确认记忆"
  }[type] || "事件";
}

function timelineMatchesPerson(entry = {}, person = currentTimelinePerson) {
  if (person === "all") {
    return true;
  }
  if (person === "me") {
    return entry.actor === "me" || entry.actor_label === momentAuthors.me || entry.role === "user";
  }
  if (["linxu", "dengdeng", "aimas"].includes(person)) {
    return entry.room === person || entry.actor === person;
  }
  return true;
}

function timelineMatchesSource(entry = {}, source = currentTimelineSource) {
  if (source === "all") {
    return true;
  }
  if (source === "chat") {
    return entry.type === "chat_message" || entry.source === "session";
  }
  if (source === "moments") {
    return entry.type === "moment_post";
  }
  if (source === "comments") {
    return entry.type === "moment_comment";
  }
  if (source === "archive") {
    return entry.source === "archive" || entry.type === "confirmed_memory";
  }
  return true;
}

function timelineMatchesFilter(entry = {}) {
  return timelineMatchesPerson(entry) && timelineMatchesSource(entry);
}

function timelineFilterLabel() {
  const personLabels = {
    all: "所有人",
    me: "我",
    linxu: "林絮",
    dengdeng: "噔噔",
    aimas: "Aimas"
  };
  const sourceLabels = {
    all: "全部来源",
    chat: "聊天",
    moments: "圈圈",
    comments: "评论",
    archive: "Archive"
  };
  return `${personLabels[currentTimelinePerson] || "所有人"} · ${sourceLabels[currentTimelineSource] || "全部来源"}`;
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
      ? `已读取 ${timelineEntries.length} 条，${timelineFilterLabel()}：${filteredEntries.length} 条。`
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
    const response = await fetch("/api/timeline?limit=160");
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    timelineEntries = Array.isArray(data.entries) ? data.entries : [];
    timelinePage = 1;
    renderTimelineEvents();
  } catch (error) {
    if (statusNode) statusNode.textContent = `时间线读取失败：${error.message}`;
    listNode.innerHTML = `<p class="timeline-empty">这次没有读到时间线。</p>`;
  }
}

async function createMoment(source = "manual") {
  const author = document.getElementById("momentAuthor")?.value || "me";
  const reason = document.getElementById("momentReason")?.value?.trim() || "刚刚聊天时想到的小事";
  const input = document.getElementById("momentText");
  const status = document.getElementById("momentStatus");
  const text = source === "auto" ? "" : input?.value?.trim() || "";
  if (source !== "auto" && !text) {
    if (!pendingMomentImage) {
      if (status) status.textContent = "先写一点文字，或者选一张图再发圈圈。";
      return;
    }
  }
  if (!serviceOnline) {
    renderMoments(createBrowserMoment(author, source === "auto" ? momentAutoText(author, reason) : (text || "分享了一张图片。"), source, reason, pendingMomentImage));
    finishMomentComposer("已先保存在这个浏览器的圈圈里。");
    return;
  }
  try {
    const imageForPost = await prepareMomentImageForPost(status);
    const response = await fetch("/api/moment-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text: text || (imageForPost ? "分享了一张图片。" : text), source, reason, image_data: imageForPost })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    renderMoments(mergeMomentEntries(readBrowserMoments(), data.entries || []));
    finishMomentComposer(pendingMomentImage && data.created?.image_relative_path
      ? `图片圈圈已写入 ${data.created.image_relative_path}`
      : `已写入 ${data.relative_path || "moments.jsonl"}`);
  } catch (error) {
    if (status) {
      status.textContent = error instanceof TypeError && String(error.message || "").includes("fetch")
        ? "发圈圈失败：本地服务没有接住这次图片请求。可以先点图片右上角 × 移除，或返回时选择不保存草稿清空。"
        : `发圈圈失败：${error.message}`;
    }
  }
}

async function createMomentFromChat(author, text) {
  const cleanText = String(text || "").trim();
  const cleanAuthor = momentAuthors[author] ? author : "me";
  if (!cleanText) {
    showChatToast("这条气泡没有可发布的文字。", "warning", 1800);
    return;
  }
  const reason = "从聊天气泡顺手发出";
  if (!serviceOnline) {
    renderMoments(createBrowserMoment(cleanAuthor, cleanText, "from_chat", reason));
    showChatToast("已先发到这个浏览器的圈圈里。", "success", 2000);
    return;
  }
  try {
    const response = await fetch("/api/moment-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: cleanAuthor, text: cleanText, source: "from_chat", reason })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    renderMoments(mergeMomentEntries(readBrowserMoments(), data.entries || []));
    showChatToast("已从聊天发到圈圈。", "success", 2000);
  } catch (error) {
    showChatToast(`发圈圈失败：${error.message}`, "warning", 2800);
  }
}

function openMomentConfirm(author, text) {
  const cleanAuthor = momentAuthors[author] ? author : "me";
  pendingChatMoment = {
    author: cleanAuthor,
    text: String(text || "").trim()
  };
  const sheet = document.getElementById("momentConfirmSheet");
  const label = document.getElementById("momentConfirmAuthor");
  const textarea = document.getElementById("momentConfirmText");
  if (label) {
    label.textContent = `将以“${momentDisplayName(cleanAuthor)}”的身份发出。`;
  }
  if (textarea) {
    textarea.value = pendingChatMoment.text;
    window.setTimeout(() => textarea.focus(), 30);
  }
  sheet?.removeAttribute("hidden");
}

function closeMomentConfirm() {
  pendingChatMoment = null;
  document.getElementById("momentConfirmSheet")?.setAttribute("hidden", "");
}

function confirmMomentFromChat() {
  if (!pendingChatMoment) {
    closeMomentConfirm();
    return;
  }
  const text = document.getElementById("momentConfirmText")?.value?.trim() || "";
  const author = pendingChatMoment.author;
  closeMomentConfirm();
  createMomentFromChat(author, text);
}

function startCommentPress(commentNode) {
  window.clearTimeout(commentPressTimer);
  commentLongPressHandled = false;
  commentPressTimer = window.setTimeout(() => {
    commentLongPressHandled = true;
    handleMomentAction(commentNode.dataset.momentId || "", "delete_comment", {
      commentId: commentNode.dataset.commentId || ""
    });
  }, 650);
}

function finishCommentPress(commentNode) {
  window.clearTimeout(commentPressTimer);
  window.setTimeout(() => {
    if (commentLongPressHandled) {
      commentLongPressHandled = false;
      return;
    }
    handleMomentAction(commentNode.dataset.momentId || "", "comment", {
      replyTo: commentNode.dataset.commentAuthor || "你"
    });
  }, 0);
}

function cancelCommentPress() {
  window.clearTimeout(commentPressTimer);
}

function renderMomentImagePreview() {
  const preview = document.getElementById("momentImagePreview");
  if (preview) {
    preview.innerHTML = pendingMomentImage
      ? `<button class="moment-image-remove" id="momentImageRemove" type="button" aria-label="移除待发布图片">×</button><img src="${escapeHtml(pendingMomentImage)}" alt="待发布图片预览" />`
      : "";
  }
}

function clearMomentImage() {
  pendingMomentImage = "";
  const picker = document.getElementById("momentImage");
  if (picker) {
    picker.value = "";
  }
  renderMomentImagePreview();
}

function showMomentComposer() {
  restoreMomentDraft();
  document.querySelector(".phone-shell")?.classList.add("moment-compose-focus");
  document.getElementById("momentsPanel")?.classList.add("is-composing");
  document.getElementById("momentComposer")?.classList.remove("is-collapsed");
  window.setTimeout(() => document.getElementById("momentText")?.focus(), 40);
}

function closeMomentComposer() {
  closeMomentComposerWithChoice();
}

async function closeMomentComposerWithChoice() {
  const composer = document.getElementById("momentComposer");
  if (!composer || composer.classList.contains("is-collapsed")) {
    return;
  }
  const defaultReason = "刚刚聊天时想到的小事";
  const reasonValue = (document.getElementById("momentReason")?.value || "").trim();
  const hasDraft = Boolean(
    (document.getElementById("momentText")?.value || "").trim() ||
    pendingMomentImage ||
    (reasonValue && reasonValue !== defaultReason)
  );
  if (hasDraft) {
    const keep = await openAppDialog({
      kicker: "DRAFT",
      title: "要保存这条圈圈草稿吗？",
      message: "保存后下次打开相机会恢复；不保存会清空文字和图片，适合发不出去时应急。",
      cancelText: "不保存",
      confirmText: "保存草稿"
    });
    if (keep) {
      writeMomentDraft();
    } else {
      clearMomentDraft();
      const input = document.getElementById("momentText");
      const reason = document.getElementById("momentReason");
      if (input) input.value = "";
      if (reason) reason.value = "刚刚聊天时想到的小事";
      clearMomentImage();
    }
  }
  composer.classList.add("is-collapsed");
  document.getElementById("momentsPanel")?.classList.remove("is-composing");
  document.querySelector(".phone-shell")?.classList.remove("moment-compose-focus");
}

function finishMomentComposer(statusText = "") {
  clearMomentDraft();
  const input = document.getElementById("momentText");
  const reason = document.getElementById("momentReason");
  if (input) input.value = "";
  if (reason) reason.value = "刚刚聊天时想到的小事";
  clearMomentImage();
  const status = document.getElementById("momentStatus");
  if (status && statusText) status.textContent = statusText;
  document.getElementById("momentComposer")?.classList.add("is-collapsed");
  document.getElementById("momentsPanel")?.classList.remove("is-composing");
  document.querySelector(".phone-shell")?.classList.remove("moment-compose-focus");
}

function openInlineMomentComment(id, replyTo = "") {
  activeMomentComment = { id, replyTo, text: "" };
  renderMoments();
  window.setTimeout(() => {
    const input = document.querySelector(`[data-moment-comment-input="${CSS.escape(id)}"]`);
    input?.focus();
    input?.setSelectionRange?.(input.value.length, input.value.length);
  }, 40);
}

function closeInlineMomentComment() {
  activeMomentComment = null;
  renderMoments();
}

function closeInlineMomentCommentIfOpen() {
  if (!activeMomentComment) {
    return;
  }
  closeInlineMomentComment();
}

async function submitInlineMomentComment(id) {
  const input = document.querySelector(`[data-moment-comment-input="${CSS.escape(id)}"]`);
  const text = input?.value?.trim() || "";
  const replyTo = activeMomentComment?.id === id ? activeMomentComment.replyTo || "" : "";
  if (!text) {
    closeInlineMomentComment();
    return;
  }
  activeMomentComment = null;
  await handleMomentAction(id, "comment_submit", { text, replyTo });
}

async function handleMomentAction(id, action, options = {}) {
  if (!id) {
    return;
  }
  const entry = latestMomentEntries.find((item) => item.id === id) || readBrowserMoments().find((item) => item.id === id);
  let text = "";
  let author = "me";
  if (action === "delete_post") {
    const ok = await openAppDialog({
      kicker: "MOMENTS",
      title: "删除这条圈圈？",
      message: "删除后当前页面不会再显示。底层会追加一条撤销事件，不会物理擦掉原始记录。",
      cancelText: "先留着",
      confirmText: "确认删除"
    });
    if (!ok) {
      return;
    }
  }
  if (action === "delete_comment") {
    if (!options.commentId) {
      return;
    }
    const ok = await openAppDialog({
      kicker: "COMMENT",
      title: "删除这条评论？",
      message: "删除后当前页面不会再显示，底层会保留撤销事件。",
      cancelText: "先留着",
      confirmText: "确认删除"
    });
    if (!ok) {
      return;
    }
    text = options.commentId;
  }
  if (action === "comment") {
    openInlineMomentComment(id, options.replyTo || "");
    return;
  }
  if (action === "comment_submit") {
    action = "comment";
    text = options.text || "";
    if (!text) {
      return;
    }
  } else if (action === "auto_comment") {
    author = ["linxu", "dengdeng", "aimas"].includes(options.commenter) ? options.commenter : "linxu";
    if (!serviceOnline || String(id).startsWith("moment-browser-")) {
      const status = document.getElementById("momentStatus");
      if (status) status.textContent = "真实回一句需要连上本地服务，并且这条圈圈已经写入本地。";
      return;
    }
    const status = document.getElementById("momentStatus");
    if (status) status.textContent = `正在请${momentAuthors[author]}回一句。`;
  }
  if (!serviceOnline || String(id).startsWith("moment-browser-")) {
    renderMoments(updateBrowserMoment(id, action, text, author, options.replyTo || ""));
    return;
  }
  try {
    const response = await fetch("/api/moment-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, author, text, comment_id: options.commentId || "", reply_to: options.replyTo || "" })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    renderMoments(mergeMomentEntries(readBrowserMoments(), data.entries || []));
    if (action === "auto_comment") {
      const status = document.getElementById("momentStatus");
      if (status) status.textContent = `${momentAuthors[author]}已回到这条圈圈下面。`;
    }
  } catch (error) {
    const status = document.getElementById("momentStatus");
    if (status) status.textContent = `圈圈操作失败：${error.message}`;
  }
}

function wakeJumpClientId(entry) {
  if (entry.chat_record?.client_id) {
    return entry.chat_record.client_id;
  }
  if (!entry.id) {
    return "";
  }
  return String(entry.id).startsWith("wake-browser")
    ? `${entry.id}-wake-browser`
    : `${entry.id}-wake`;
}

function renderWakePagination(total, page, totalPages) {
  if (totalPages <= 1) {
    return `<div class="wake-page-note">共 ${total} 张，当前全部显示。</div>`;
  }
  return `
    <nav class="wake-pagination" aria-label="醒醒收件箱分页">
      <button type="button" data-wake-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>上一页</button>
      <span>第 ${page} / ${totalPages} 页 · 共 ${total} 张</span>
      <button type="button" data-wake-page="${Math.min(totalPages, page + 1)}" ${page >= totalPages ? "disabled" : ""}>下一页</button>
    </nav>
  `;
}

function renderWakeInbox(entries = wakeInboxEntries, requestedPage = wakeInboxPage) {
  const box = document.getElementById("wakeInbox");
  if (!box) {
    return;
  }
  wakeInboxEntries = Array.isArray(entries) ? entries : [];
  const total = wakeInboxEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / wakePageSize));
  wakeInboxPage = Math.min(Math.max(1, requestedPage || 1), totalPages);
  if (!total) {
    box.innerHTML = `<p class="config-status">还没有小纸条。这里以后会变成主动唤醒收件箱。</p>`;
    return;
  }
  const start = (wakeInboxPage - 1) * wakePageSize;
  const pageEntries = wakeInboxEntries.slice(start, start + wakePageSize);
  box.innerHTML = pageEntries
    .map(
      (entry, index) => {
        const sourceLabel = entry.auto_candidate || entry.source === "auto" ? "自动候选" : "手动草稿";
        const position = start + index + 1;
        const shortId = String(entry.id || "").replace(/^wake-browser-auto-|^wake-browser-|^wake-/, "").slice(0, 12);
        const canJump = entry.sent_to_chat || entry.status === "sent_to_chat";
        const jumpId = wakeJumpClientId(entry);
        return `
        <article class="wake-cardlet">
          <span>${escapeHtml(entry.room_label || roomLabels[entry.room] || "小窝")} · ${escapeHtml(formatSessionTime(entry.timestamp))}</span>
          <small class="wake-index">第 ${position} / ${total} 张 · ${escapeHtml(shortId || "no-id")}</small>
          <strong>${escapeHtml(entry.reason || "唤醒草稿")}</strong>
          <p>${escapeHtml(entry.text || "")}</p>
          <em>${sourceLabel} · ${entry.pushed ? "已推送" : "未推送"} · ${entry.tool_allowed ? "允许工具" : "禁用工具"} · ${escapeHtml(entry.status || "draft_only")}</em>
          <div class="wake-actions">
            <button type="button" data-wake-action="send_to_chat" data-wake-id="${escapeHtml(entry.id || "")}">放进聊天</button>
            ${canJump ? `<button type="button" data-wake-action="jump_to_chat" data-wake-room="${escapeHtml(entry.room || "linxu")}" data-wake-draft-id="${escapeHtml(jumpId)}">去聊天</button>` : ""}
            <button type="button" data-wake-action="keep" data-wake-id="${escapeHtml(entry.id || "")}">收下</button>
            <button type="button" data-wake-action="dismiss" data-wake-id="${escapeHtml(entry.id || "")}">丢掉</button>
          </div>
        </article>
      `;
      }
    )
    .join("") + renderWakePagination(total, wakeInboxPage, totalPages);
}

async function loadWakeInbox() {
  const box = document.getElementById("wakeInbox");
  if (!box) {
    return;
  }
  if (!serviceOnline) {
    renderWakeInbox(readBrowserWakeInbox());
    return;
  }
  try {
    const response = await fetch("/api/wake-inbox?limit=500");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    renderWakeInbox(data.entries || []);
  } catch (error) {
    box.innerHTML = `<p class="config-status">唤醒收件箱读取失败：${escapeHtml(error.message)}</p>`;
  }
}

function browserWakeKey() {
  return "stillgarden.wake.inbox";
}

function readBrowserWakeInbox() {
  try {
    const entries = JSON.parse(window.localStorage.getItem(browserWakeKey()) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    return [];
  }
}

function writeBrowserWakeDraft(record) {
  const entries = [record, ...readBrowserWakeInbox()].slice(0, 500);
  try {
    window.localStorage.setItem(browserWakeKey(), JSON.stringify(entries));
  } catch (error) {
    // Current page still renders the generated draft.
  }
  return entries;
}

function chooseBrowserAutoWakeRoom() {
  const entries = readBrowserWakeInbox();
  const today = new Date().toISOString().slice(0, 10);
  const todayAutoRooms = new Set();
  entries.forEach((entry) => {
    if (
      !autoWakeOrder.includes(entry.room)
      || !entry.auto_candidate
      || !String(entry.timestamp || "").startsWith(today)
    ) {
      return;
    }
    todayAutoRooms.add(entry.room);
  });
  return autoWakeOrder.find((room) => !todayAutoRooms.has(room)) || null;
}

function updateBrowserWakeDraft(id, action) {
  const entries = readBrowserWakeInbox();
  const next = entries
    .map((entry) => {
      if (entry.id !== id) {
        return entry;
      }
      if (action === "send_to_chat") {
        return { ...entry, status: "sent_to_chat", sent_to_chat: true };
      }
      if (action === "keep") {
        return { ...entry, status: "kept", kept: true };
      }
      if (action === "dismiss") {
        return { ...entry, status: "dismissed", dismissed: true };
      }
      return entry;
    })
    .filter((entry) => entry.status !== "dismissed");
  try {
    window.localStorage.setItem(browserWakeKey(), JSON.stringify(next));
  } catch (error) {
    // Visible list still updates in memory.
  }
  return next;
}

async function handleWakeAction(id, action) {
  if (action === "jump_to_chat") {
    return;
  }
  if (!id || !action) {
    return;
  }
  if (!serviceOnline) {
    const entries = readBrowserWakeInbox();
    const match = entries.find((entry) => entry.id === id);
    if (action === "send_to_chat" && match) {
      const record = makeDraftRecord(match.room, match.text, "assistant");
      record.client_id = `${id}-wake-browser`;
      writeBrowserEntry(match.room, record);
      refreshConversationPreview(match.room);
    }
    renderWakeInbox(updateBrowserWakeDraft(id, action));
    return;
  }
  try {
    const response = await fetch("/api/wake-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, action })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    if (action === "send_to_chat" && data.record?.room) {
      refreshConversationPreview(data.record.room);
    }
    await loadWakeInbox();
  } catch (error) {
    const box = document.getElementById("wakeInbox");
    if (box) {
      box.insertAdjacentHTML("afterbegin", `<p class="config-status">操作失败：${escapeHtml(error.message)}</p>`);
    }
  }
}

async function createWakeDraft() {
  const room = document.getElementById("wakeResident")?.value || "linxu";
  const reason = document.getElementById("wakeReason")?.value?.trim() || "想轻轻问候一下";
  const label = roomLabels[room] || chatProfiles[room]?.name || room;
  const button = document.getElementById("wakeCreateButton");
  showWakeNotice("");
  if (button) {
    button.disabled = true;
  }
  try {
    if (!serviceOnline) {
      const record = {
        id: `wake-browser-${Date.now()}`,
        timestamp: new Date().toISOString(),
        room,
        room_label: label,
        reason,
        text: formatWakeText(room, label, reason),
        status: "browser_draft_only",
        pushed: false,
        tool_allowed: false,
        archive_write: false
      };
      wakeInboxPage = 1;
      renderWakeInbox(writeBrowserWakeDraft(record), 1);
      return;
    }
    const response = await fetch("/api/wake-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ room, reason })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    wakeInboxPage = 1;
    await loadWakeInbox();
  } catch (error) {
    const box = document.getElementById("wakeInbox");
    if (box) {
      box.innerHTML = `<p class="config-status">唤醒草稿生成失败：${escapeHtml(error.message)}</p>`;
    }
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function createAutoWakeDraft() {
  const button = document.getElementById("wakeAutoButton");
  showWakeNotice("");
  if (button) {
    button.disabled = true;
  }
  try {
    if (!serviceOnline) {
      const room = chooseBrowserAutoWakeRoom();
      if (!room) {
        showWakeNotice("今天的自动候选已经备齐，不再重复生成。");
        renderWakeInbox(readBrowserWakeInbox());
        return;
      }
      const label = roomLabels[room] || chatProfiles[room]?.name || room;
      const reason = autoWakeReasons[room] || "想轻轻问候一下";
      const record = {
        id: `wake-browser-auto-${Date.now()}`,
        timestamp: new Date().toISOString(),
        room,
        room_label: label,
        reason,
        text: formatWakeText(room, label, reason),
        status: "browser_auto_candidate",
        source: "auto",
        auto_candidate: true,
        trigger: "manual_auto_candidate",
        pushed: false,
        tool_allowed: false,
        archive_write: false
      };
      wakeInboxPage = 1;
      renderWakeInbox(writeBrowserWakeDraft(record), 1);
      return;
    }
    const response = await fetch("/api/wake-auto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    wakeInboxPage = 1;
    await loadWakeInbox();
    if (data.duplicate_prevented) {
      showWakeNotice(data.message || "今天的自动候选已经备齐，不再重复生成。");
    }
  } catch (error) {
    const box = document.getElementById("wakeInbox");
    if (box) {
      box.innerHTML = `<p class="config-status">自动唤醒候选生成失败：${escapeHtml(error.message)}</p>`;
    }
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

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
    const response = await fetch("/api/memory-confirmed?limit=8");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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
    const response = await fetch("/api/memory-daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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
    const response = await fetch("/api/memory-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room,
        category,
        title,
        text,
        relation_object: relationObject,
        importance,
        readable_scope: readableScope,
        sensitive,
        candidate_id: currentMemoryCandidateId
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
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
    const response = await fetch("/api/memory-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    memoryStatus(`${data.message} 当前确认记忆 ${formatNumber(data.confirmed_count || 0)} 条。`);
    await loadConfirmedMemory();
  } catch (error) {
    memoryStatus(`刷新失败：${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
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

function formatPreviewItems(items = [], emptyText = "无。") {
  if (!items.length) {
    return `- ${emptyText}`;
  }
  return items
    .slice(0, 6)
    .map((item, index) => {
      const meta = [
        item.source_index || item.role || "",
        item.date || item.timestamp || "",
        item.phase || "",
        item.flags?.length ? `标记：${item.flags.join(", ")}` : ""
      ].filter(Boolean).join(" · ");
      const text = item.summary || item.text || item.reference || "";
      return `- ${index + 1}. ${item.title || item.role || "片段"}${meta ? `（${meta}）` : ""}${text ? `\n  ${text}` : ""}`;
    })
    .join("\n");
}

function formatContextPreview(preview = {}, includeRawHeader = true) {
  const shortContext = preview.short_context || {};
  const longTerm = preview.long_term || {};
  const confirmed = preview.confirmed_memory || {};
  const selfState = preview.self || {};
  const policy = preview.policy || {};
  const route = preview.route || {};
  const selfReaders = selfState.readers || {};
  const readableSelfNames = Object.entries(selfReaders)
    .filter(([, enabled]) => enabled)
    .map(([reader]) => selfReaderLabels[reader] || reader);
  const shortItems = (shortContext.items || []).map((item) => ({
    ...item,
    title: item.role === "user" ? "你" : "对方",
    role: item.role === "user" ? "你" : "对方"
  }));
  return [
    `## A. 请求路线`,
    `- 房间：${preview.room_label || preview.room || "未知"}`,
    `- 检索目标：${preview.display || preview.target || "未知"}`,
    `- 路线：${route.type || "unknown"} / ${route.route_id || "none"}`,
    `- 当前消息：${preview.query || "无"}`,
    ``,
    `## B. 短期 session`,
    `- 本次带入最近 ${shortContext.count || 0} / ${shortContext.window || 18} 条同房间聊天。`,
    formatPreviewItems(shortItems, "这次没有旧的短期聊天。"),
    ``,
    `## C. 长期候选`,
    `- 原始命中：${formatNumber(longTerm.raw_match_count || 0)}；折叠后：${formatNumber(longTerm.collapsed_match_count || 0)}；本次候选：${formatNumber(longTerm.candidate_count || 0)}。`,
    formatPreviewItems(longTerm.items || [], "没有长期候选随请求带入。"),
    ``,
    `## D. 确认记忆`,
    `- 本次命中确认记忆：${formatNumber(confirmed.candidate_count || 0)} 条。`,
    formatPreviewItems(confirmed.items || [], "没有命中的确认记忆。"),
    ``,
    `## E. self 与敏感内容`,
    `- self 总开关：${selfState.master_enabled ? "打开" : "关闭"}`,
    `- self 可读对象：${readableSelfNames.length ? readableSelfNames.join("、") : "无"}`,
    `- 本次是否带入 self：${selfState.enabled ? "是" : "否"}`,
    `- 敏感标记：${policy.include_sensitive ? "允许包含" : "默认排除"}`,
    `- self 文件状态：${(selfState.files || []).map((item) => `${item.path}${item.included ? " 已带入" : " 未带入"}`).join("；") || "无"}`,
    ``,
    `## F. 禁止读取`,
    `${(policy.forbidden || []).slice(0, 8).map((item) => `- ${item}`).join("\n") || "- 无额外禁止列表。"}`
  ];
  if (includeRawHeader) {
    lines.push("", "## G. 原始上下文全文");
  }
  return lines.join("\n");
}

function formatRequestPackage(data, profile, text) {
  const routeType = data.record?.route?.type || "unknown";
  const routeId = data.record?.route?.route_id || "none";
  const shortText = text.length > 220 ? `${text.slice(0, 220)}...` : text;
  const preview = data.context_preview ? formatContextPreview(data.context_preview) : "";
  return `# 上下文颗粒度检查单\n\n` +
    `# 1. 你在聊天框实际发出的内容\n\n` +
    `${shortText}\n\n` +
    `# 2. 小窝本地保存\n\n` +
    `- 当前 session：${profile.name}\n` +
    `- session 日志：已先把这条消息写入当前房间 JSONL，所以本轮第一条消息也会参与请求包\n` +
    `- 请求包保存位置：${data.relative_path || "未写入"}\n\n` +
    `# 3. 小窝准备的请求包\n\n` +
    `- 状态：请求包已写入；配置齐全时继续调用真实 API / Agent\n` +
    `- 路线：${routeType} / ${routeId}\n` +
    `- 时机：不是进房间前预热，而是发送后按“当前消息 + 同房间最近记录 + 命中的长期候选”组包\n` +
    `- 说明：聊天框里能看见的是第 1 层；模型/Agent 是否能利用下面的上下文，取决于 provider 或 Hermes 中间层怎么转交。\n\n` +
    `${preview ? `# 4. 本次准备带入的上下文预览\n\n${preview}\n\n` : ""}` +
    `${data.markdown || data.message || "没有生成上下文。"}`;
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
  try {
    window.localStorage.removeItem(browserDraftKey(room));
  } catch (error) {
    // The visible screen can still be cleared even if localStorage is unavailable.
  }
  const slot = document.getElementById("savedDraftsSlot");
  if (slot) {
    slot.innerHTML = "";
  }
  updateConversationPreview(room, []);
  closeChatInfoSheet();
  showChatToast("当前屏幕已清空；D 盘记录还在。", "success", 2400);
}

document.querySelectorAll(".resident").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".resident").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.getElementById("residentCopy").textContent = residentCopy[button.dataset.resident];
  });
});

document.getElementById("momentPostButton")?.addEventListener("click", () => createMoment("manual"));
document.getElementById("momentAutoButton")?.addEventListener("click", () => createMoment("auto"));
document.getElementById("momentCameraButton")?.addEventListener("click", showMomentComposer);
document.getElementById("momentCoverButton")?.addEventListener("click", () => {
  document.getElementById("momentCoverInput")?.click();
});
document.getElementById("momentCoverInput")?.addEventListener("change", (event) => {
  readImageFileAsDataUrl(event.target.files?.[0], saveMomentCover, { serverAsset: true });
  event.target.value = "";
});
document.getElementById("momentAllButton")?.addEventListener("click", () => setMomentScope("all"));
document.getElementById("momentHeroAvatar")?.addEventListener("click", () => {
  setMomentScope(currentMomentScope === "all" ? "me" : currentMomentScope);
});
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
document.getElementById("momentConfirmCancel")?.addEventListener("click", closeMomentConfirm);
document.getElementById("momentConfirmSend")?.addEventListener("click", confirmMomentFromChat);
document.getElementById("momentComposerBack")?.addEventListener("click", closeMomentComposer);
document.getElementById("momentComposerSave")?.addEventListener("click", closeMomentComposer);
["momentAuthor", "momentText", "momentReason"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", writeMomentDraft);
  document.getElementById(id)?.addEventListener("change", writeMomentDraft);
});
document.getElementById("appDialogCancel")?.addEventListener("click", () => closeAppDialog(null));
document.getElementById("appDialogConfirm")?.addEventListener("click", () => {
  const input = document.getElementById("appDialogInput");
  closeAppDialog(input && !input.hidden ? input.value : true);
});
document.getElementById("appDialogSheet")?.addEventListener("click", (event) => {
  if (event.target.id === "appDialogSheet") {
    closeAppDialog(null);
  }
});
document.getElementById("appDialogInput")?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  closeAppDialog(event.target.value);
});
document.getElementById("momentImage")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  const status = document.getElementById("momentStatus");
  if (!file) {
    clearMomentImage();
    return;
  }
  if (status) {
    status.textContent = "正在压缩图片，稍等一下。";
  }
  readImageFileAsDataUrl(file, (dataUrl, meta = {}) => {
    pendingMomentImage = String(dataUrl || "");
    renderMomentImagePreview();
    writeMomentDraft();
    if (status) {
      const sizeText = meta.bytes ? `约 ${Math.max(1, Math.round(meta.bytes / 1024))}KB` : "";
      status.textContent = serviceOnline
        ? `图片已${meta.compressed ? "自动压缩并" : ""}放进发布框${sizeText ? `（${sizeText}）` : ""}；发布后会写入 D 盘资产库。`
        : "图片已放进发布框；当前离线时会先保存在这个浏览器。";
    }
  }, {
    serverAsset: true,
    sourceLimitBytes: 120_000_000,
    limitBytes: serviceOnline ? 1_500_000 : 1_500_000,
    maxOutputBytes: 900_000
  });
  event.target.value = "";
});

document.getElementById("momentsPanel")?.addEventListener("scroll", () => {
  if (document.activeElement?.closest?.(".moment-inline-comment")) {
    return;
  }
  if (activeMomentComment) {
    activeMomentComment = null;
    renderMoments();
  }
}, { passive: true });

document.getElementById("momentsPanel")?.addEventListener("wheel", (event) => {
  if (event.deltaY > 8) {
    closeInlineMomentCommentIfOpen();
  }
}, { passive: true });

document.getElementById("momentsPanel")?.addEventListener("touchstart", (event) => {
  momentTouchStartY = event.touches?.[0]?.clientY ?? null;
}, { passive: true });

document.getElementById("momentsPanel")?.addEventListener("touchmove", (event) => {
  if (momentTouchStartY === null) {
    return;
  }
  const nextY = event.touches?.[0]?.clientY ?? momentTouchStartY;
  if (momentTouchStartY - nextY > 12) {
    momentTouchStartY = nextY;
    closeInlineMomentCommentIfOpen();
  }
}, { passive: true });

document.addEventListener("input", (event) => {
  const commentInput = event.target.closest?.("[data-moment-comment-input]");
  if (commentInput && activeMomentComment?.id === commentInput.dataset.momentCommentInput) {
    activeMomentComment.text = commentInput.value;
  }
});

document.addEventListener("keydown", (event) => {
  const commentInput = event.target.closest?.("[data-moment-comment-input]");
  if (!commentInput || event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  submitInlineMomentComment(commentInput.dataset.momentCommentInput || "");
});

document.addEventListener("click", (event) => {
  if (
    activeMomentComment &&
    !event.target.closest(".moment-inline-comment") &&
    !event.target.closest("[data-comment-id]") &&
    !event.target.closest(".moment-more-menu")
  ) {
    closeInlineMomentCommentIfOpen();
  }
  const commentSubmit = event.target.closest("[data-moment-comment-submit]");
  if (commentSubmit) {
    submitInlineMomentComment(commentSubmit.dataset.momentCommentSubmit || "");
    return;
  }
  const commentCancel = event.target.closest("[data-moment-comment-cancel]");
  if (commentCancel) {
    closeInlineMomentComment();
    return;
  }
  const bubbleMomentButton = event.target.closest("[data-bubble-moment]");
  if (bubbleMomentButton) {
    const bubble = bubbleMomentButton.closest(".bubble");
    const text = bubble?.querySelector("p")?.textContent || "";
    const author = bubble?.dataset?.bubbleAuthor || "me";
    openMomentConfirm(author, text);
    return;
  }
  const scopeButton = event.target.closest("[data-moment-scope]");
  if (scopeButton) {
    setMomentScope(scopeButton.dataset.momentScope || "all");
    return;
  }
  const imageRemove = event.target.closest("#momentImageRemove, .moment-image-remove");
  if (imageRemove) {
    event.preventDefault();
    clearMomentImage();
    writeMomentDraft();
    const status = document.getElementById("momentStatus");
    if (status) status.textContent = "已移除待发布图片。";
    return;
  }
  const button = event.target.closest("[data-moment-action]");
  if (!button) {
    return;
  }
  button.closest(".moment-more-menu")?.removeAttribute("open");
  handleMomentAction(button.dataset.momentId || "", button.dataset.momentAction || "", {
    commenter: button.dataset.momentCommenter || ""
  });
});

document.addEventListener("pointerdown", (event) => {
  const commentNode = event.target.closest("[data-comment-id]");
  if (!commentNode) {
    return;
  }
  startCommentPress(commentNode);
});

document.addEventListener("pointerup", (event) => {
  const commentNode = event.target.closest("[data-comment-id]");
  if (!commentNode) {
    cancelCommentPress();
    return;
  }
  finishCommentPress(commentNode);
});

document.addEventListener("pointercancel", cancelCommentPress);
document.addEventListener("pointerleave", (event) => {
  if (event.target.closest?.("[data-comment-id]")) {
    cancelCommentPress();
  }
});

document.querySelectorAll(".room-tile").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".room-tile").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    selectedRoom = button.dataset.room;
    const room = rooms[button.dataset.room];
    const preview = document.getElementById("roomPreview");
    if (!preview) {
      return;
    }
    preview.dataset.subpageTitle = room.title;
    preview.innerHTML = `
      <span>${escapeHtml(room.label)}</span>
      <h3>${escapeHtml(room.title)}</h3>
      <p>${escapeHtml(room.body)}</p>
      <label class="context-field">
        <span>想带什么话题进去？</span>
        <input id="contextQuery" type="text" value="${escapeHtml(room.query)}" />
      </label>
      <div class="room-actions">
        <button class="room-chat-button" type="button" data-open-chat-room="${button.dataset.room}">进入聊天</button>
        <button class="context-button" type="button" data-context-room="${button.dataset.room}">生成上下文草稿</button>
      </div>
      <pre class="context-output" id="contextOutput">如果直接双击打开，这里会显示静态提示。启动本地小窝服务后，这个按钮会调用记忆工具。</pre>
    `;
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-chat-room]");
  if (!button) {
    return;
  }
  openChatRoom(button.dataset.openChatRoom || selectedRoom);
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".context-button");
  if (!button) {
    return;
  }

  const output = document.getElementById("contextOutput");
  const input = document.getElementById("contextQuery");
  const room = button.dataset.contextRoom || selectedRoom;
  const query = input?.value?.trim() || rooms[room]?.query || "边界";
  button.disabled = true;
  output.textContent = "正在敲门取上下文草稿...";

  try {
    const response = await fetch(`/api/context?room=${encodeURIComponent(room)}&query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    output.textContent = data.markdown || data.message || "没有生成内容。";
  } catch (error) {
    output.textContent =
      "现在是静态页面模式，还没有启动本地小窝服务。\n\n" +
      "如果只是看外观，直接这样打开就可以。\n" +
      "如果要真的调用记忆工具，请运行同文件夹里的 start-stillgarden.bat。\n\n" +
      `当前房间：${rooms[room]?.title || room}\n` +
      `当前话题：${query}`;
  } finally {
    button.disabled = false;
  }
});

document.getElementById("archiveSearchButton")?.addEventListener("click", async () => {
  const room = document.getElementById("archiveRoom")?.value || "linxu";
  const query = document.getElementById("archiveQuery")?.value?.trim() || "人格";
  const includeSensitive = document.getElementById("archiveSensitive")?.checked || false;
  const output = document.getElementById("archiveResults");
  const button = document.getElementById("archiveSearchButton");
  button.disabled = true;
  output.textContent = "正在轻轻翻抽屉...";
  try {
    const response = await fetch(
      `/api/search?room=${encodeURIComponent(room)}&query=${encodeURIComponent(query)}&include_sensitive=${includeSensitive}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
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

document.getElementById("chatSendButton")?.addEventListener("click", sendChatDraft);

document.getElementById("chatDraft")?.addEventListener("input", resizeChatDraftInput);

document.getElementById("chatDraft")?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  sendChatDraft();
});

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
document.getElementById("memoryDailyButton")?.addEventListener("click", generateDailyMemoryDraft);
document.getElementById("memoryConfirmButton")?.addEventListener("click", confirmMemoryEntry);
document.getElementById("memoryRefreshButton")?.addEventListener("click", refreshMemoryIndex);
document.getElementById("wakeAutoButton")?.addEventListener("click", createAutoWakeDraft);
document.getElementById("wakeCreateButton")?.addEventListener("click", createWakeDraft);

document.getElementById("wakeInbox")?.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-wake-page]");
  if (pageButton) {
    renderWakeInbox(wakeInboxEntries, Number(pageButton.dataset.wakePage || 1));
    return;
  }
  const button = event.target.closest("[data-wake-action]");
  if (!button) {
    return;
  }
  if (button.dataset.wakeAction === "jump_to_chat") {
    openChatAtRecord(button.dataset.wakeRoom || "linxu", button.dataset.wakeDraftId || "");
    return;
  }
  handleWakeAction(button.dataset.wakeId, button.dataset.wakeAction);
});

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

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-subpage-target]");
  if (!button) {
    return;
  }
  event.preventDefault();
  openSubpage(button.dataset.subpageTarget);
});

document.querySelectorAll(".dock-item").forEach((button) => {
  button.addEventListener("click", () => {
    activatePanel(button.dataset.target);
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadServiceStatus();
  }
});

loadHomeStats();
startServiceHeartbeat();
["me", "linxu", "dengdeng", "aimas", "living"].forEach((room) => applyProfileAssetsToVisibleNodes(room));
refreshAllConversationPreviews();
resizeChatDraftInput();
loadWakeInbox();
loadMoments();
loadConfirmedMemory();
