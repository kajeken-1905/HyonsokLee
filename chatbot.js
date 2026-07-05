const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `당신은 MLB(메이저리그 야구) 전문 AI 어시스턴트입니다.
사용자는 MLB 일정·결과·순위·선수 기록 페이지를 보고 있습니다.

역할:
- MLB 규칙, 팀, 선수, 경기, 통계, 역사에 대해 친절하고 정확하게 답변합니다.
- 한국어로 답변하되, 팀명·선수명은 원문(영어)과 함께 표기해도 좋습니다.
- 모르는 최신 정보는 추측하지 말고, 확인이 필요하다고 안내합니다.
- 답변은 간결하고 읽기 쉽게 작성합니다.`;

const chatbotElements = {
  panel: document.getElementById("chatbotPanel"),
  toggle: document.getElementById("chatbotToggle"),
  closeBtn: document.getElementById("chatbotCloseBtn"),
  settingsBtn: document.getElementById("chatbotSettingsBtn"),
  settings: document.getElementById("chatbotSettings"),
  apiKeyInput: document.getElementById("chatbotApiKey"),
  modelSelect: document.getElementById("chatbotModel"),
  saveKeyBtn: document.getElementById("chatbotSaveKeyBtn"),
  messages: document.getElementById("chatbotMessages"),
  form: document.getElementById("chatbotForm"),
  input: document.getElementById("chatbotInput"),
  sendBtn: document.getElementById("chatbotSendBtn"),
};

let conversationHistory = [];
let isSending = false;

function getApiKey() {
  return OpenAIConfig.getApiKey();
}

function getModel() {
  return OpenAIConfig.getModel();
}

function closeOtherPanels() {
  const imagebotPanel = document.getElementById("imagebotPanel");
  const imagebotToggle = document.getElementById("imagebotToggle");
  if (imagebotPanel && !imagebotPanel.hidden) {
    imagebotPanel.hidden = true;
    imagebotToggle.hidden = false;
    imagebotToggle.setAttribute("aria-expanded", "false");
  }
}

function saveSettings() {
  const key = chatbotElements.apiKeyInput.value.trim();
  const model = chatbotElements.modelSelect.value;

  if (!key.startsWith("sk-")) {
    appendSystemMessage("올바른 OpenAI API 키(sk-로 시작)를 입력해 주세요.");
    return;
  }

  OpenAIConfig.saveApiKey(key);
  OpenAIConfig.saveModel(model);
  chatbotElements.settings.hidden = true;
  appendSystemMessage("API 키가 저장되었습니다. 챗봇과 이미지 생성봇 모두 사용할 수 있습니다.");
}

function loadSettings() {
  chatbotElements.apiKeyInput.value = getApiKey();
  chatbotElements.modelSelect.value = getModel();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(text) {
  return escapeHtml(text)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function scrollToBottom() {
  chatbotElements.messages.scrollTop = chatbotElements.messages.scrollHeight;
}

function appendMessage(role, content, options = {}) {
  const { isError = false, isSystem = false } = options;
  const bubble = document.createElement("div");
  bubble.className = `chatbot-msg ${role}${isError ? " error" : ""}${isSystem ? " system" : ""}`;
  bubble.innerHTML = `<div class="chatbot-bubble">${formatMessage(content)}</div>`;
  chatbotElements.messages.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function appendSystemMessage(content) {
  appendMessage("assistant", content, { isSystem: true });
}

function appendLoadingMessage() {
  const bubble = document.createElement("div");
  bubble.className = "chatbot-msg assistant loading";
  bubble.id = "chatbotLoading";
  bubble.innerHTML = `
    <div class="chatbot-bubble">
      <span class="chatbot-typing"><span></span><span></span><span></span></span>
    </div>
  `;
  chatbotElements.messages.appendChild(bubble);
  scrollToBottom();
}

function removeLoadingMessage() {
  document.getElementById("chatbotLoading")?.remove();
}

function setSending(sending) {
  isSending = sending;
  chatbotElements.sendBtn.disabled = sending;
  chatbotElements.input.disabled = sending;
}

function openPanel() {
  closeOtherPanels();
  chatbotElements.panel.hidden = false;
  chatbotElements.toggle.setAttribute("aria-expanded", "true");
  chatbotElements.toggle.hidden = true;

  if (chatbotElements.messages.children.length === 0) {
    showWelcome();
  }

  chatbotElements.input.focus();
}

function closePanel() {
  chatbotElements.panel.hidden = true;
  chatbotElements.toggle.hidden = false;
  chatbotElements.toggle.setAttribute("aria-expanded", "false");
}

function toggleSettings() {
  chatbotElements.settings.hidden = !chatbotElements.settings.hidden;
}

function showWelcome() {
  if (!getApiKey()) {
    appendSystemMessage(
      "안녕하세요! MLB AI 어시스턴트입니다.\n\n" +
        "먼저 우측 상단 ⚙️ 버튼을 눌러 OpenAI API 키를 입력하고 저장해 주세요."
    );
    chatbotElements.settings.hidden = false;
    return;
  }

  appendSystemMessage(
    "안녕하세요! MLB 규칙, 팀, 선수, 경기에 대해 무엇이든 물어보세요.\n" +
      "예: \"오늘 MLB 경기가 몇 경기야?\", \"홈런왕 순위 알려줘\", \"DH 규칙 설명해줘\""
  );
}

async function callOpenAI(messages) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.message || `API 오류 (${response.status})`;
    throw new Error(errMsg);
  }

  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error("응답을 받지 못했습니다.");
  }

  return reply.trim();
}

function getErrorMessage(error) {
  if (error.message === "API_KEY_MISSING") {
    return "API 키가 설정되지 않았습니다. ⚙️ 버튼에서 키를 저장해 주세요.";
  }
  if (error.message.includes("Incorrect API key")) {
    return "API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.";
  }
  if (error.message.includes("insufficient_quota")) {
    return "OpenAI 사용 한도가 초과되었습니다. 계정 크레딧을 확인해 주세요.";
  }
  if (error.message.includes("Failed to fetch")) {
    return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.";
  }
  return error.message || "알 수 없는 오류가 발생했습니다.";
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || isSending) return;

  if (!getApiKey()) {
    appendSystemMessage("API 키를 먼저 저장해 주세요.");
    chatbotElements.settings.hidden = false;
    return;
  }

  appendMessage("user", trimmed);
  chatbotElements.input.value = "";
  chatbotElements.input.style.height = "auto";

  conversationHistory.push({ role: "user", content: trimmed });

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
  ];

  setSending(true);
  appendLoadingMessage();

  try {
    const reply = await callOpenAI(apiMessages);
    removeLoadingMessage();
    appendMessage("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });

    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
  } catch (error) {
    removeLoadingMessage();
    appendMessage("assistant", getErrorMessage(error), { isError: true });
    conversationHistory.pop();
  } finally {
    setSending(false);
    chatbotElements.input.focus();
  }
}

function autoResizeTextarea() {
  chatbotElements.input.style.height = "auto";
  chatbotElements.input.style.height = `${Math.min(chatbotElements.input.scrollHeight, 120)}px`;
}

chatbotElements.toggle.addEventListener("click", openPanel);
chatbotElements.closeBtn.addEventListener("click", closePanel);
chatbotElements.settingsBtn.addEventListener("click", toggleSettings);
chatbotElements.saveKeyBtn.addEventListener("click", saveSettings);

chatbotElements.form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(chatbotElements.input.value);
});

chatbotElements.input.addEventListener("input", autoResizeTextarea);

chatbotElements.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatbotElements.input.value);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !chatbotElements.panel.hidden) {
    closePanel();
  }
});

loadSettings();
