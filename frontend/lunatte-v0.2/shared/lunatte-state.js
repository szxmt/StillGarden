(function (global) {
  "use strict";

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

    function readChatPrefs() {
      return readObject(keys.chatPrefs());
    }

    function writeChatPrefs(prefs) {
      return writeJson(keys.chatPrefs(), prefs || {});
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
      readChatPrefs,
      writeChatPrefs,
      chatPrefsFor(room) {
        return readChatPrefs()[room] || {};
      },
      updateChatPrefs(room, patch) {
        const prefs = readChatPrefs();
        prefs[room] = {
          ...(prefs[room] || {}),
          ...(patch || {})
        };
        return writeChatPrefs(prefs);
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

  global.LunatteState = {
    createBrowserStorage
  };
})(window);
