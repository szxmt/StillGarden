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
    const data = await appApi.getMoments({ limit: 80 });
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
    const data = await appApi.createMoment({
      author,
      text: text || (imageForPost ? "分享了一张图片。" : text),
      source,
      reason,
      image_data: imageForPost
    });
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
    const data = await appApi.createMoment({ author: cleanAuthor, text: cleanText, source: "from_chat", reason });
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
    const data = await appApi.runMomentAction({
      id,
      action,
      author,
      text,
      comment_id: options.commentId || "",
      reply_to: options.replyTo || ""
    });
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
