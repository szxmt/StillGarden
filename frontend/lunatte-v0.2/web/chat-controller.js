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

function initChatController() {
  document.getElementById("chatSendButton")?.addEventListener("click", sendChatDraft);

  document.getElementById("chatDraft")?.addEventListener("input", resizeChatDraftInput);

  document.getElementById("chatDraft")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    sendChatDraft();
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
}
