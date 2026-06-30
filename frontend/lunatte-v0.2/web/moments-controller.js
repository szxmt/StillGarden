function showWakeNotice(message) {
  const notice = document.getElementById("wakeNotice");
  if (!notice) {
    return;
  }
  notice.textContent = message || "";
}

function momentBrowserKey() {
  return browserStore.momentBrowserKey();
}

function momentDraftKey() {
  return browserStore.momentDraftKey();
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
  return browserStore.readBrowserMoments();
}

function writeBrowserMoments(entries) {
  browserStore.writeBrowserMoments(entries);
}

function readMomentDraft() {
  return browserStore.readMomentDraft();
}

function writeMomentDraft() {
  const draft = {
    author: document.getElementById("momentAuthor")?.value || "me",
    text: document.getElementById("momentText")?.value || "",
    reason: document.getElementById("momentReason")?.value || "",
    image_data: pendingMomentImage || "",
    saved_at: new Date().toISOString()
  };
  if (!browserStore.writeMomentDraft(draft)) {
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
  browserStore.clearMomentDraft();
}

function createBrowserMoment(author, text, source = "manual", reason = "", imageData = "") {
  const post = createMomentEntry({
    author,
    authorLabel: momentDisplayName(author),
    text,
    imageData,
    source,
    reason
  });
  const entries = [post, ...readBrowserMoments()];
  writeBrowserMoments(entries);
  return entries;
}

function updateBrowserMoment(id, action, text = "", author = "me", replyTo = "") {
  const entries = applyMomentAction(readBrowserMoments(), {
    id,
    action,
    text,
    author,
    authorLabel: momentDisplayName(author),
    replyTo
  });
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
function initMomentsControllerBase() {
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
}

function initMomentComposerAndActions() {
  document.getElementById("momentConfirmCancel")?.addEventListener("click", closeMomentConfirm);
  document.getElementById("momentConfirmSend")?.addEventListener("click", confirmMomentFromChat);
  document.getElementById("momentComposerBack")?.addEventListener("click", closeMomentComposer);
  document.getElementById("momentComposerSave")?.addEventListener("click", closeMomentComposer);
  ["momentAuthor", "momentText", "momentReason"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", writeMomentDraft);
    document.getElementById(id)?.addEventListener("change", writeMomentDraft);
  });
}

function initMomentImageAndInteraction() {
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
}

function initMomentAutoPreviewActions() {
  document.getElementById("momentAutoPreviewButton")?.addEventListener("click", previewMomentsAutoComments);
  document.getElementById("momentAutoPreview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-moment-auto-run]");
    if (!button) {
      return;
    }
    runMomentsAutoCandidate(button.dataset.momentAutoRun || "", button.dataset.momentAutoCommenter || "");
  });
}

function initMomentsController() {
  initMomentsControllerBase();
  initMomentComposerAndActions();
  initMomentImageAndInteraction();
  initMomentAutoPreviewActions();
}
