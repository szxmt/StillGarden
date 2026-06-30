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
