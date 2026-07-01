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
    const data = await appApi.getWakeInbox({ limit: 500 });
    renderWakeInbox(data.entries || []);
  } catch (error) {
    box.innerHTML = `<p class="config-status">唤醒收件箱读取失败：${escapeHtml(error.message)}</p>`;
  }
}

function browserWakeKey() {
  return browserStore.browserWakeKey();
}

function readBrowserWakeInbox() {
  return browserStore.readBrowserWakeInbox();
}

function writeBrowserWakeDraft(record) {
  return browserStore.writeBrowserWakeDraft(record);
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
  return browserStore.updateBrowserWakeDraft(id, action);
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
      const record = createDraftRecord(match.room, match.text, "assistant");
      record.client_id = `${id}-wake-browser`;
      writeBrowserEntry(match.room, record);
      refreshConversationPreview(match.room);
    }
    renderWakeInbox(updateBrowserWakeDraft(id, action));
    return;
  }
  try {
    const data = await appApi.updateWakeDraft(id, action);
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
    const data = await appApi.createWakeDraft({ room, reason });
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
    const data = await appApi.createAutoWakeDraft();
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
function initWakeController() {
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
}

