(function (global) {
  "use strict";

  function createClient(options = {}) {
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

    function queryString(params = {}) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        search.set(key, String(value));
      });
      const text = search.toString();
      return text ? `?${text}` : "";
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

    function getSession(room, options = {}) {
      return getJson(`/api/session-log${queryString({
        room,
        limit: options.limit ?? 8,
        query: options.query || ""
      })}`);
    }

    function saveSessionMessage(room, text) {
      requireOnline();
      return postJson("/api/session-log", {
        room,
        text: text.text || text,
        client_id: text.client_id
      });
    }

    function buildChatPackage(room, draftRecord) {
      requireOnline();
      return postJson("/api/chat-package", {
        room,
        text: draftRecord.text,
        client_id: draftRecord.client_id
      });
    }

    function callAimasAgent(draftRecord) {
      requireOnline();
      return postJson("/api/aimas-chat", {
        text: draftRecord.text,
        client_id: draftRecord.client_id
      });
    }

    function callProviderModel(room, draftRecord) {
      requireOnline();
      return postJson("/api/provider-chat", {
        room,
        text: draftRecord.text,
        client_id: draftRecord.client_id
      });
    }

    return {
      requestJson,
      getJson,
      postJson,
      getStats: () => getJson("/api/stats"),
      getHealth: () => getJson("/api/health"),
      getConfig: () => getJson("/api/config"),
      saveConfig: (payload) => postJson("/api/config", payload),
      getSession,
      fetchSessionLog(room, limit = 8, query = "") {
        return getSession(room, { limit, query });
      },
      saveSessionMessage,
      buildChatPackage,
      callAimasAgent,
      callProviderModel,
      previewMomentsAutoComments: () => getJson("/api/moments-auto-preview"),
      runMomentAction: (payload) => postJson("/api/moment-action", payload),
      probeAimas: (payload) => postJson("/api/aimas-probe", payload),
      getProfileAssets: () => getJson("/api/profile-assets"),
      saveProfileAsset: (payload) => postJson("/api/profile-asset", payload),
      clearProfileAssets: (payload) => postJson("/api/profile-assets-clear", payload),
      getMoments: (options = {}) => getJson(`/api/moments${queryString({ limit: options.limit ?? 80 })}`),
      createMoment: (payload) => postJson("/api/moment-create", payload),
      getTimeline: (options = {}) => getJson(`/api/timeline${queryString({ limit: options.limit ?? 160 })}`),
      getWakeInbox: (options = {}) => getJson(`/api/wake-inbox${queryString({ limit: options.limit ?? 500 })}`),
      updateWakeDraft: (id, action) => postJson("/api/wake-action", { id, action }),
      createWakeDraft: (payload) => postJson("/api/wake-draft", payload),
      createAutoWakeDraft: () => postJson("/api/wake-auto", {}),
      getConfirmedMemory: (options = {}) => getJson(`/api/memory-confirmed${queryString({ limit: options.limit ?? 8 })}`),
      createDailyMemorySummary: (payload) => postJson("/api/memory-daily-summary", payload),
      confirmMemory: (payload) => postJson("/api/memory-confirm", payload),
      refreshMemoryIndex: () => postJson("/api/memory-refresh", {}),
      getContext: (payload) => getJson(`/api/context${queryString({ room: payload.room, query: payload.query })}`),
      searchArchive: (payload) => getJson(`/api/search${queryString({
        room: payload.room,
        query: payload.query,
        include_sensitive: Boolean(payload.includeSensitive)
      })}`),
      stats: () => getJson("/api/stats"),
      health: () => getJson("/api/health"),
      config: () => getJson("/api/config")
    };
  }

  global.LunatteApi = {
    createClient
  };
})(window);
