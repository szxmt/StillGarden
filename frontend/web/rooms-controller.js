function initRoomsControllerBase() {
  document.querySelectorAll(".resident").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".resident").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById("residentCopy").textContent = residentCopy[button.dataset.resident];
    });
  });
}

function initRoomTilesAndContext() {
  document.querySelectorAll(".room-tile").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".room-tile").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      selectedRoom = button.dataset.room;
      const room = rooms[button.dataset.room];
      const preview = document.getElementById("roomPreview");
      if (!preview) {
        return;
      }
      preview.dataset.subpageTitle = room.title;
      preview.innerHTML = `
        <span>${escapeHtml(room.label)}</span>
        <h3>${escapeHtml(room.title)}</h3>
        <p>${escapeHtml(room.body)}</p>
        <label class="context-field">
          <span>想带什么话题进去？</span>
          <input id="contextQuery" type="text" value="${escapeHtml(room.query)}" />
        </label>
        <div class="room-actions">
          <button class="room-chat-button" type="button" data-open-chat-room="${button.dataset.room}">进入聊天</button>
          <button class="context-button" type="button" data-context-room="${button.dataset.room}">生成上下文草稿</button>
        </div>
        <pre class="context-output" id="contextOutput">如果直接双击打开，这里会显示静态提示。启动本地小窝服务后，这个按钮会调用记忆工具。</pre>
      `;
    });
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-chat-room]");
    if (!button) {
      return;
    }
    openChatRoom(button.dataset.openChatRoom || selectedRoom);
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".context-button");
    if (!button) {
      return;
    }

    const output = document.getElementById("contextOutput");
    const input = document.getElementById("contextQuery");
    const room = button.dataset.contextRoom || selectedRoom;
    const query = input?.value?.trim() || rooms[room]?.query || "边界";
    button.disabled = true;
    output.textContent = "正在敲门取上下文草稿...";

    try {
      const data = await appApi.getContext({ room, query });
      output.textContent = data.markdown || data.message || "没有生成内容。";
    } catch (error) {
      output.textContent =
        "现在是静态页面模式，还没有启动本地小窝服务。\n\n" +
        "如果只是看外观，直接这样打开就可以。\n" +
        "如果要真的调用记忆工具，请运行项目根目录里的 start-lunatte.bat。\n\n" +
        `当前房间：${rooms[room]?.title || room}\n` +
        `当前话题：${query}`;
    } finally {
      button.disabled = false;
    }
  });
}

function initRoomsController() {
  initRoomsControllerBase();
  initRoomTilesAndContext();
}
