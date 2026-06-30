async function saveSelfAccessConfig() {
  const status = document.getElementById("selfAccessStatus");
  if (!apiConfigCache) {
    apiConfigCache = normalizeApiConfig(defaultApiConfig);
  }
  apiConfigCache.self_access = normalizeSelfAccess(selfAccessFromControls());
  renderSelfAccessPanel();
  if (!serviceOnline) {
    if (status) status.textContent = "未连接本地服务：self 开关暂时不能写入 D 盘。";
    return;
  }
  if (status) status.textContent = "正在保存 self 可读范围...";
  try {
    const data = await appApi.saveConfig(collectApiConfigForSave());
    apiConfigCache = normalizeApiConfig(data.config);
    refreshMyNicknameLabels();
    renderApiConfig(selectedProviderId);
    if (status) status.textContent = "self 可读范围已保存。";
  } catch (error) {
    if (status) status.textContent = `self 开关保存失败：${error.message}`;
  }
}

function myNickname() {
  return normalizeUserProfile(apiConfigCache?.user_profile || defaultApiConfig.user_profile).nickname;
}

function refreshMyNicknameLabels() {
  momentAuthors.me = myNickname();
  const name = document.getElementById("myProfileName");
  const preview = document.getElementById("myProfilePreview");
  const input = document.getElementById("myProfileNicknameInput");
  const momentMeOption = document.querySelector('#momentAuthor option[value="me"]');
  if (name) name.textContent = momentAuthors.me;
  if (preview) preview.textContent = `${momentAuthors.me}的小窝视角。`;
  if (input && document.activeElement !== input) input.value = momentAuthors.me;
  if (momentMeOption) momentMeOption.textContent = momentAuthors.me;
  if (currentMomentScope === "all" || currentMomentScope === "me") {
    updateMomentHero();
  }
}

function selfAccessFromControls() {
  const readers = {};
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    readers[input.dataset.selfReader] = input.getAttribute("aria-pressed") === "true";
  });
  const anyReader = Object.values(readers).some(Boolean);
  return {
    enabled: document.getElementById("selfAccessMaster")?.getAttribute("aria-pressed") === "true" && anyReader,
    readers: {
      linxu: Boolean(readers.linxu),
      dengdeng: Boolean(readers.dengdeng),
      aimas: Boolean(readers.aimas)
    }
  };
}

function renderSelfAccessPanel() {
  const selfAccess = normalizeSelfAccess(apiConfigCache?.self_access || defaultApiConfig.self_access);
  const master = document.getElementById("selfAccessMaster");
  if (master) {
    master.setAttribute("aria-pressed", selfAccess.enabled ? "true" : "false");
    master.setAttribute("aria-expanded", selfAccess.enabled ? "true" : "false");
    master.classList.toggle("is-on", selfAccess.enabled);
  }
  document.querySelectorAll(".self-access-reader").forEach((input) => {
    const reader = input.dataset.selfReader;
    const isOn = Boolean(selfAccess.enabled && selfAccess.readers?.[reader]);
    input.setAttribute("aria-pressed", isOn ? "true" : "false");
    input.classList.toggle("is-on", isOn);
  });
  document.getElementById("selfAccessReaders")?.classList.toggle("is-open", selfAccess.enabled);
  const openReaders = Object.entries(selfAccess.readers || {})
    .filter(([, enabled]) => enabled)
    .map(([reader]) => selfReaderLabels[reader] || reader);
  const text = selfAccess.enabled
    ? `self：已开启，${openReaders.join("、") || "未选择"}可读`
    : "self：关闭，不会带入任何请求";
  const status = document.getElementById("selfAccessStatus");
  if (status) status.textContent = text;
}
