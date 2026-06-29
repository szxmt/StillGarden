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
    createApiClient
  };
})(window);
