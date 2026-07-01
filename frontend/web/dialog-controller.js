function showChatToast(message, kind = "info", holdMs = 2200) {
  const toast = document.getElementById("chatToast");
  if (!toast) {
    return;
  }
  window.clearTimeout(chatToastTimer);
  toast.textContent = message;
  toast.className = `chat-toast show ${kind}`;
  chatToastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, holdMs);
}

function closeAppDialog(result = null) {
  const sheet = document.getElementById("appDialogSheet");
  sheet?.setAttribute("hidden", "");
  if (appDialogResolver) {
    appDialogResolver(result);
    appDialogResolver = null;
  }
}

function openAppDialog({
  kicker = "STILLGARDEN",
  title = "确认一下",
  message = "",
  input = false,
  value = "",
  placeholder = "",
  cancelText = "取消",
  confirmText = "确认"
} = {}) {
  const sheet = document.getElementById("appDialogSheet");
  const inputNode = document.getElementById("appDialogInput");
  if (!sheet || !inputNode) {
    return Promise.resolve(null);
  }
  if (appDialogResolver) {
    closeAppDialog(null);
  }
  document.getElementById("appDialogKicker").textContent = kicker;
  document.getElementById("appDialogTitle").textContent = title;
  document.getElementById("appDialogMessage").textContent = message;
  document.getElementById("appDialogCancel").textContent = cancelText;
  document.getElementById("appDialogConfirm").textContent = confirmText;
  inputNode.hidden = !input;
  inputNode.value = value;
  inputNode.placeholder = placeholder;
  sheet.removeAttribute("hidden");
  if (input) {
    window.setTimeout(() => {
      inputNode.focus();
      inputNode.select();
    }, 30);
  }
  return new Promise((resolve) => {
    appDialogResolver = resolve;
  });
}
function initDialogController() {
  document.getElementById("appDialogCancel")?.addEventListener("click", () => closeAppDialog(null));
  document.getElementById("appDialogConfirm")?.addEventListener("click", () => {
    const input = document.getElementById("appDialogInput");
    closeAppDialog(input && !input.hidden ? input.value : true);
  });
  document.getElementById("appDialogSheet")?.addEventListener("click", (event) => {
    if (event.target.id === "appDialogSheet") {
      closeAppDialog(null);
    }
  });
  document.getElementById("appDialogInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    closeAppDialog(event.target.value);
  });
}

