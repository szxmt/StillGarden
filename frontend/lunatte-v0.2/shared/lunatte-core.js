// Shared prototype core: no DOM reads, no rendering, reusable by future Web/App layers.
(function initLunatteCore(global) {
  "use strict";

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

  function normalizeUserProfile(value = {}) {
    const nickname = String(value.nickname || defaultApiConfig.user_profile.nickname || "小宝").trim().slice(0, 20);
    return {
      nickname: nickname || "小宝"
    };
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

  function createMomentEntry(options = {}) {
    const author = options.author || "me";
    return {
      id: options.id || `moment-browser-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: options.timestamp || new Date().toISOString(),
      author,
      author_label: options.authorLabel || options.author_label || author,
      text: options.text || "",
      image_data: options.imageData || options.image_data || "",
      source: options.source || "manual",
      reason: options.reason || "",
      likes: [],
      comments: []
    };
  }

  function applyMomentAction(entries = [], options = {}) {
    const id = options.id || "";
    const action = options.action || "";
    return (entries || [])
      .map((entry) => {
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
            id: options.commentId || `comment-browser-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: options.timestamp || new Date().toISOString(),
            author: options.author || "me",
            author_label: options.authorLabel || options.author_label || options.author || "me",
            text: options.text || "",
            reply_to: options.replyTo || options.reply_to || ""
          };
          return { ...entry, comments: [...(entry.comments || []), comment] };
        }
        if (action === "delete_comment") {
          return { ...entry, comments: (entry.comments || []).filter((comment) => comment.id !== options.text) };
        }
        return entry;
      })
      .filter((entry) => !(entry.id === id && action === "delete_post"));
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

  function momentEntriesSignature(entries = []) {
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

  function timelineTypeLabel(type = "") {
    return {
      chat_message: "聊天",
      moment_post: "圈圈",
      moment_comment: "评论",
      confirmed_memory: "确认记忆"
    }[type] || "事件";
  }

  function timelineMatchesPerson(entry = {}, person = "all", options = {}) {
    if (person === "all") {
      return true;
    }
    if (person === "me") {
      return entry.actor === "me" || entry.actor_label === options.meLabel || entry.role === "user";
    }
    if (["linxu", "dengdeng", "aimas"].includes(person)) {
      return entry.room === person || entry.actor === person;
    }
    return true;
  }

  function timelineMatchesSource(entry = {}, source = "all") {
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

  function timelineFilterLabel(person = "all", source = "all") {
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
    return `${personLabels[person] || "所有人"} · ${sourceLabels[source] || "全部来源"}`;
  }

  function createApiClient(options = {}) {
    const fetchImpl = options.fetchImpl || global.fetch?.bind(global);
    const isOnline = options.isOnline || (() => true);

    function ensureFetch() {
      if (!fetchImpl) {
        throw new Error("fetch unavailable");
      }
    }

    function requireOnline() {
      if (!isOnline()) {
        throw new Error("local service offline");
      }
    }

    async function requestJson(path, options = {}) {
      ensureFetch();
      const response = await fetchImpl(path, options);
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }
      return data;
    }

    function getJson(path) {
      return requestJson(path);
    }

    function postJson(path, body) {
      return requestJson(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    }

    return {
      getJson,
      postJson,
      stats: () => getJson("/api/stats"),
      health: () => getJson("/api/health"),
      config: () => getJson("/api/config"),
      saveConfig: (config) => postJson("/api/config", config),
      fetchSessionLog(room, limit = 8, query = "") {
        const params = new URLSearchParams({ room, limit: String(limit) });
        if (query) {
          params.set("query", query);
        }
        return getJson(`/api/session-log?${params.toString()}`);
      },
      saveSessionMessage(room, text) {
        requireOnline();
        return postJson("/api/session-log", { room, text: text.text || text, client_id: text.client_id });
      },
      buildChatPackage(room, draftRecord) {
        requireOnline();
        return postJson("/api/chat-package", { room, text: draftRecord.text, client_id: draftRecord.client_id });
      },
      callAimasAgent(draftRecord) {
        requireOnline();
        return postJson("/api/aimas-chat", { text: draftRecord.text, client_id: draftRecord.client_id });
      },
      callProviderModel(room, draftRecord) {
        requireOnline();
        return postJson("/api/provider-chat", { room, text: draftRecord.text, client_id: draftRecord.client_id });
      }
    };
  }

  function createBrowserStorage(storage = global.localStorage) {
    const keys = {
      browserDraft: (room) => `stillgarden.session.${room}.drafts`,
      chatPrefs: () => "stillgarden.chat.preferences",
      profileAssets: () => "stillgarden.profile.assets",
      momentBrowser: () => "stillgarden.moments.feed",
      momentDraft: () => "stillgarden.moments.draft",
      wakeInbox: () => "stillgarden.wake.inbox"
    };

    function readJson(key, fallback) {
      try {
        const raw = storage?.getItem(key);
        if (!raw) {
          return fallback;
        }
        const value = JSON.parse(raw);
        return value ?? fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeJson(key, value) {
      try {
        storage?.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }

    function remove(key) {
      try {
        storage?.removeItem(key);
        return true;
      } catch (error) {
        return false;
      }
    }

    function readArray(key) {
      const value = readJson(key, []);
      return Array.isArray(value) ? value : [];
    }

    function readObject(key) {
      const value = readJson(key, {});
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    return {
      browserDraftKey: keys.browserDraft,
      chatPrefsKey: keys.chatPrefs,
      profileAssetsKey: keys.profileAssets,
      momentBrowserKey: keys.momentBrowser,
      momentDraftKey: keys.momentDraft,
      browserWakeKey: keys.wakeInbox,
      readBrowserDrafts(room) {
        return readArray(keys.browserDraft(room));
      },
      writeBrowserEntry(room, record) {
        const entries = [...readArray(keys.browserDraft(room)), record].slice(-60);
        writeJson(keys.browserDraft(room), entries);
        return record;
      },
      removeBrowserDraft(room) {
        return remove(keys.browserDraft(room));
      },
      readChatPrefs() {
        return readObject(keys.chatPrefs());
      },
      writeChatPrefs(prefs) {
        return writeJson(keys.chatPrefs(), prefs || {});
      },
      readProfileAssets() {
        return readObject(keys.profileAssets());
      },
      writeProfileAssets(assets) {
        return writeJson(keys.profileAssets(), assets || {});
      },
      readBrowserMoments() {
        return readArray(keys.momentBrowser());
      },
      writeBrowserMoments(entries) {
        return writeJson(keys.momentBrowser(), (entries || []).slice(0, 200));
      },
      readMomentDraft() {
        return readObject(keys.momentDraft());
      },
      writeMomentDraft(draft) {
        return writeJson(keys.momentDraft(), draft || {});
      },
      clearMomentDraft() {
        return remove(keys.momentDraft());
      },
      readBrowserWakeInbox() {
        return readArray(keys.wakeInbox());
      },
      writeBrowserWakeDraft(record) {
        const entries = [record, ...readArray(keys.wakeInbox())].slice(0, 500);
        writeJson(keys.wakeInbox(), entries);
        return entries;
      },
      updateBrowserWakeDraft(id, action) {
        const next = readArray(keys.wakeInbox())
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
        writeJson(keys.wakeInbox(), next);
        return next;
      }
    };
  }

  global.LunatteCore = {
    residentCopy,
    rooms,
    defaultApiConfig,
    roomLabels,
    memoryScopeLabels,
    selfReaderLabels,
    momentAutoReaderLabels,
    memoryImportanceLabels,
    autoWakeReasons,
    autoWakeOrder,
    momentAuthors,
    chatProfiles,
    normalizeApiConfig,
    normalizeUserProfile,
    normalizeSelfAccess,
    normalizeMomentsAutoComments,
    createMomentEntry,
    applyMomentAction,
    mergeMomentEntries,
    momentEntriesSignature,
    timelineTypeLabel,
    timelineMatchesPerson,
    timelineMatchesSource,
    timelineFilterLabel,
    createBrowserStorage,
    createApiClient
  };
})(window);
