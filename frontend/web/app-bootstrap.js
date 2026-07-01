const {
  residentCopy,
  rooms,
  defaultApiConfig,
  roomLabels,
  memoryScopeLabels,
  selfReaderLabels,
  momentAutoReaderLabels,
  memoryImportanceLabels,
  autoWakeReasons,
  autoWakeOrder,
  momentAuthors,
  chatProfiles,
  normalizeApiConfig,
  normalizeUserProfile,
  normalizeSelfAccess,
  normalizeMomentsAutoComments,
  formatNumber,
  formatSessionTime,
  formatConversationTime,
  resultMeta,
  createDraftRecord,
  mergeDraftEntriesWithLimit,
  mergeDraftEntries,
  formatWakeText,
  wakeJumpClientId,
  formatPreviewItems,
  formatContextPreview,
  formatRequestPackage,
  createMomentEntry,
  applyMomentAction,
  mergeMomentEntries,
  momentEntriesSignature,
  timelineTypeLabel,
  timelineMatchesPerson,
  timelineMatchesSource,
  timelineFilterLabel
} = window.LunatteCore;

let selectedRoom = "linxu";
let selectedChatRoom = "linxu";
let serviceOnline = false;
let serviceHeartbeatTimer = null;
let chatToastTimer = null;
let chatSearchTimer = null;
let chatSearchRunId = 0;
let apiConfigLoaded = false;
let apiConfigCache = null;
let selectedProviderId = "oa";
const wakePageSize = 5;
let wakeInboxEntries = [];
let wakeInboxPage = 1;
let currentMemoryCandidateId = "";
let timelineEntries = [];
let currentTimelinePerson = "all";
let currentTimelineSource = "all";
let timelinePage = 1;
const timelinePageSize = 5;
const appApi = window.LunatteApi.createClient({ isOnline: () => serviceOnline });
const browserStore = window.LunatteState.createBrowserStorage();

let pendingMomentImage = "";
let currentMomentScope = "all";
let latestMomentEntries = [];
let latestMomentSignature = "";
let pendingChatMoment = null;
let appDialogResolver = null;
let commentPressTimer = null;
let commentLongPressHandled = false;
let activeMomentComment = null;
let momentTouchStartY = null;
let profileReturnTarget = "chat";
let serverProfileAssets = {};
let profileAssetsLoaded = false;
let profileAssetsSignature = "";



function startServiceHeartbeat() {
  loadServiceStatus();
  if (serviceHeartbeatTimer) {
    window.clearInterval(serviceHeartbeatTimer);
  }
  serviceHeartbeatTimer = window.setInterval(loadServiceStatus, 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resizeChatDraftInput() {
  const input = document.getElementById("chatDraft");
  if (!input) {
    return;
  }
  input.style.height = "auto";
  const maxHeight = 138;
  const nextHeight = Math.min(input.scrollHeight, maxHeight);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
}

async function fetchSessionLog(room, limit = 8, query = "") {
  return appApi.fetchSessionLog(room, limit, query);
}

async function saveSessionMessage(room, text) {
  return appApi.saveSessionMessage(room, text);
}

async function buildChatPackage(room, draftRecord) {
  return appApi.buildChatPackage(room, draftRecord);
}

async function callAimasAgent(draftRecord) {
  return appApi.callAimasAgent(draftRecord);
}

async function callProviderModel(room, draftRecord) {
  return appApi.callProviderModel(room, draftRecord);
}

function bootLunatteApp() {
  initHomeController();
  initRoomsController();
  initNavigationController();
  initDialogController();
  initProfileController();
  initMomentsController();
  initChatController();
  initSettingsController();
  initArchiveController();
  initWakeController();
  initTimelineController();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadServiceStatus();
    }
  });
  loadHomeStats();
  startServiceHeartbeat();
  ["me", "linxu", "dengdeng", "aimas", "living"].forEach((room) => applyProfileAssetsToVisibleNodes(room));
  refreshAllConversationPreviews();
  resizeChatDraftInput();
  loadWakeInbox();
  loadMoments();
  loadConfirmedMemory();
}

window.LunatteWebApp = {
  boot: bootLunatteApp
};
