function initSettingsController() {
  document.getElementById("apiConfigSave")?.addEventListener("click", saveApiConfig);
  document.getElementById("selfAccessMaster")?.addEventListener("click", (event) => {
    const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
    document.querySelectorAll(".self-access-reader").forEach((input) => {
      input.setAttribute("aria-pressed", next ? "true" : "false");
      input.classList.toggle("is-on", next);
    });
    saveSelfAccessConfig();
  });
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    input.addEventListener("click", (event) => {
      const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
      event.currentTarget.classList.toggle("is-on", next);
      const anyReader = Array.from(document.querySelectorAll(".self-access-reader"))
        .some((item) => item.getAttribute("aria-pressed") === "true");
      const master = document.getElementById("selfAccessMaster");
      if (master) {
        master.setAttribute("aria-pressed", anyReader ? "true" : "false");
      }
      saveSelfAccessConfig();
    });
  });
  document.getElementById("momentAutoCommentMaster")?.addEventListener("click", (event) => {
    const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
    document.querySelectorAll(".moment-auto-reader").forEach((input) => {
      input.setAttribute("aria-pressed", next ? "true" : "false");
      input.classList.toggle("is-on", next);
    });
    saveMomentsAutoCommentsConfig();
  });
  document.querySelectorAll(".moment-auto-reader").forEach((input) => {
    input.addEventListener("click", (event) => {
      const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", next ? "true" : "false");
      event.currentTarget.classList.toggle("is-on", next);
      const anyReader = Array.from(document.querySelectorAll(".moment-auto-reader"))
        .some((item) => item.getAttribute("aria-pressed") === "true");
      const master = document.getElementById("momentAutoCommentMaster");
      if (master) {
        master.setAttribute("aria-pressed", anyReader ? "true" : "false");
      }
      saveMomentsAutoCommentsConfig();
    });
  });
  ["momentAutoCooldown", "momentAutoQuietStart", "momentAutoQuietEnd"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", saveMomentsAutoCommentsConfig);
  });
  document.getElementById("momentAutoPreviewButton")?.addEventListener("click", previewMomentsAutoComments);
  document.getElementById("momentAutoPreview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-moment-auto-run]");
    if (!button) {
      return;
    }
    runMomentsAutoCandidate(button.dataset.momentAutoRun || "", button.dataset.momentAutoCommenter || "");
  });
  document.getElementById("customProviderAdd")?.addEventListener("click", createCustomProvider);
  document.getElementById("customProviderDelete")?.addEventListener("click", deleteSelectedCustomProvider);
  document.getElementById("aimasProbeButton")?.addEventListener("click", probeAimasConnector);
  document.getElementById("renameRoomButton")?.addEventListener("click", renameCurrentRoom);
  document.getElementById("providerSelect")?.addEventListener("change", (event) => {
    syncSelectedProviderToCache();
    selectedProviderId = event.target.value;
    renderSelectedProvider();
  });

  document.getElementById("linxuProviderRoute")?.addEventListener("change", (event) => {
    if (apiConfigCache?.room_routes) {
      apiConfigCache.room_routes.linxu = event.target.value;
    }
  });

  document.getElementById("dengdengProviderRoute")?.addEventListener("change", (event) => {
    if (apiConfigCache?.room_routes) {
      apiConfigCache.room_routes.dengdeng = event.target.value;
    }
  });

}
