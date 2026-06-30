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

function renderMomentImagePreview() {
  const preview = document.getElementById("momentImagePreview");
  if (preview) {
    preview.innerHTML = pendingMomentImage
      ? `<button class="moment-image-remove" id="momentImageRemove" type="button" aria-label="移除待发布图片">×</button><img src="${escapeHtml(pendingMomentImage)}" alt="待发布图片预览" />`
      : "";
  }
}
