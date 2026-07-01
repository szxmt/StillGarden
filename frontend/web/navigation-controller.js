function activatePanel(panelName) {
  closeAllSubpages();
  closeProfileSheet({ restore: false });
  closeChatInfoSheet();
  document.getElementById("chatWindow")?.classList.remove("detail-open");
  document.querySelector(".phone-shell")?.classList.remove("chat-focus", "subpage-focus");
  document.querySelectorAll(".dock-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.target === panelName);
  });
  document.querySelectorAll(".app-page").forEach((page) => page.classList.remove("active-page"));
  const target = document.querySelector(`[data-panel="${panelName}"]`);
  if (target) {
    target.classList.add("active-page");
    window.scrollTo({ top: 0, behavior: "smooth" });
    panelDidOpen(panelName);
  }
}

function ensureSubpageAppbar(card, panel) {
  let bar = card.querySelector(":scope > .subpage-appbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "subpage-appbar";
    const button = document.createElement("button");
    button.className = "subpage-back";
    button.type = "button";
    button.textContent = "‹";
    button.setAttribute("aria-label", "返回");
    button.addEventListener("click", () => {
      if (card.querySelector("#momentsPanel.active-subpage.is-composing")) {
        closeMomentComposer();
        return;
      }
      if (card.querySelector("#momentsPanel.active-subpage") && currentMomentScope !== "all") {
        setMomentScope("all");
        return;
      }
      closeSubpage(card);
    });
    const title = document.createElement("span");
    title.className = "subpage-title";
    bar.append(button, title);
    card.appendChild(bar);
  }
  const isMomentsPanel = panel?.id === "momentsPanel";
  bar.classList.toggle("moment-subpage-appbar", isMomentsPanel);
  const button = bar.querySelector(".subpage-back");
  if (button) {
    button.innerHTML = isMomentsPanel
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.6 8.4 12l6.4 6.4"/></svg>`
      : "‹";
  }
  const title = bar.querySelector(".subpage-title");
  if (title) {
    title.textContent = panel?.dataset?.subpageTitle || "详情";
  }
  return bar;
}

function closeSubpage(card) {
  if (!card) {
    return;
  }
  const wasMomentsPanel = Boolean(card.querySelector("#momentsPanel.active-subpage"));
  if (wasMomentsPanel) {
    closeMomentComposer();
    activeMomentComment = null;
  }
  card.classList.remove("subpage-open");
  document.querySelector(".phone-shell")?.classList.remove("subpage-focus");
  card.querySelectorAll(".active-subpage").forEach((panel) => {
    panel.classList.remove("active-subpage");
    if (panel.matches("details")) {
      panel.removeAttribute("open");
    }
  });
  if (wasMomentsPanel) {
    setMomentScope("all");
  }
}

function closeAllSubpages() {
  document.querySelectorAll(".phone-card.subpage-open").forEach((card) => closeSubpage(card));
}

function panelDidOpen(panelName) {
  if (panelName === "timeline") {
    loadTimeline();
  }
}

function openSubpage(targetId) {
  const panel = document.getElementById(targetId);
  if (!panel) {
    return;
  }
  const card = panel.closest(".phone-card");
  if (!card) {
    return;
  }
  closeSubpage(card);
  ensureSubpageAppbar(card, panel);
  document.querySelector(".phone-shell")?.classList.add("subpage-focus");
  card.classList.add("subpage-open");
  panel.classList.add("active-subpage");
  if (panel.matches("details")) {
    panel.setAttribute("open", "");
  }
  if (targetId === "myProfilePanel") {
    renderMyProfilePanel();
  }
  panel.scrollTop = 0;
}
function initNavigationController() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-subpage-target]");
    if (!button) {
      return;
    }
    event.preventDefault();
    openSubpage(button.dataset.subpageTarget);
  });

  document.querySelectorAll(".dock-item").forEach((button) => {
    button.addEventListener("click", () => {
      activatePanel(button.dataset.target);
    });
  });
}

