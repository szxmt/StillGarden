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
