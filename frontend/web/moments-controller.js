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
