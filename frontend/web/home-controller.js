async function loadHomeStats() {
  const status = document.getElementById("homeStatus");
  try {
    const data = await appApi.getStats();
    document.getElementById("statGptChats").textContent = formatNumber(data.gpt_conversations);
    document.getElementById("statGeminiCards").textContent = formatNumber(data.gemini_activities);
    document.getElementById("statSupplements").textContent = formatNumber(data.incoming_supplements);
    document.getElementById("statResidents").textContent = formatNumber(data.residents);
    status.innerHTML = `
      <span>LOCAL INDEX</span>
      <p>
        关系节点：${formatNumber(data.relationship_nodes)} 条；
        日常索引：${formatNumber(data.daily_entries)} 条；
        人格证据：${formatNumber(data.persona_evidence)} 条。
        Aimas：${data.aimas_status}
      </p>
    `;
  } catch (error) {
    status.innerHTML = `
      <span>STATIC MODE</span>
      <p>现在是静态页面。双击 start-lunatte.bat 后，Home 会读取本地 memory/data 的真实统计。</p>
    `;
  }
}

async function loadServiceStatus() {
  const status = document.getElementById("serviceStatus");
  if (!status) {
    return;
  }
  const label = status.querySelector("b") || status;
  if (window.location.protocol === "file:") {
    serviceOnline = false;
    label.textContent = "未连接";
    status.title = "静态预览：当前是直接打开文件，只会保存到这个浏览器。请用 start-lunatte.bat 打开的网页来写入 D 盘。";
    status.className = "service-pill offline";
    return;
  }
  try {
    const data = await appApi.getHealth();
    serviceOnline = Boolean(data.ok);
    label.textContent = serviceOnline ? "已连接" : "未连接";
    const started = data.started_at ? `；启动于 ${formatSessionTime(data.started_at)}` : "";
    const pid = data.pid ? `；PID ${data.pid}` : "";
    status.title = serviceOnline
      ? `本地服务已连接：草稿会写入 ${data.sessions}${started}${pid}`
      : data.message || "本地服务状态异常。";
    status.className = serviceOnline ? "service-pill online" : "service-pill offline";
    if (serviceOnline && !apiConfigLoaded) {
      loadApiConfig();
    }
    if (serviceOnline && !profileAssetsLoaded) {
      loadProfileAssets();
    }
    if (serviceOnline) {
      loadWakeInbox();
      loadMoments({ background: true });
      loadConfirmedMemory();
    }
  } catch (error) {
    serviceOnline = false;
    label.textContent = "未连接";
    status.title = `静态预览：还没有连上本地服务，只会保存到这个浏览器。原因：${error.message}`;
    status.className = "service-pill offline";
  }
}

function initHomeController() {
  
}

