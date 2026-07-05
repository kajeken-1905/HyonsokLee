const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

const imagebotElements = {
  panel: document.getElementById("imagebotPanel"),
  toggle: document.getElementById("imagebotToggle"),
  closeBtn: document.getElementById("imagebotCloseBtn"),
  form: document.getElementById("imagebotForm"),
  promptInput: document.getElementById("imagebotPrompt"),
  generateBtn: document.getElementById("imagebotGenerateBtn"),
  gallery: document.getElementById("imagebotGallery"),
  galleryEmpty: document.getElementById("imagebotGalleryEmpty"),
  status: document.getElementById("imagebotStatus"),
  lightbox: document.getElementById("imagebotLightbox"),
  lightboxImg: document.getElementById("imagebotLightboxImg"),
  lightboxCaption: document.getElementById("imagebotLightboxCaption"),
  lightboxClose: document.getElementById("imagebotLightboxClose"),
  lightboxDownload: document.getElementById("imagebotLightboxDownload"),
};

let isGenerating = false;
let generatedImages = [];
let activeLightboxIndex = -1;

function getApiKey() {
  return OpenAIConfig.getApiKey();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function closeOtherPanels() {
  const chatbotPanel = document.getElementById("chatbotPanel");
  const chatbotToggle = document.getElementById("chatbotToggle");
  if (chatbotPanel && !chatbotPanel.hidden) {
    chatbotPanel.hidden = true;
    chatbotToggle.hidden = false;
    chatbotToggle.setAttribute("aria-expanded", "false");
  }
}

function openPanel() {
  closeOtherPanels();
  imagebotElements.panel.hidden = false;
  imagebotElements.toggle.hidden = true;
  imagebotElements.toggle.setAttribute("aria-expanded", "true");
  updateStatus();
  imagebotElements.promptInput.focus();
}

function closePanel() {
  imagebotElements.panel.hidden = true;
  imagebotElements.toggle.hidden = false;
  imagebotElements.toggle.setAttribute("aria-expanded", "false");
  closeLightbox();
}

function updateStatus() {
  if (!getApiKey()) {
    imagebotElements.status.textContent =
      "API 키가 없습니다. MLB AI 챗봇 ⚙️ 설정에서 OpenAI API 키를 저장해 주세요.";
    imagebotElements.status.className = "imagebot-status warn";
    return;
  }

  imagebotElements.status.textContent =
    "챗봇과 동일한 OpenAI API 키를 사용합니다. 프롬프트를 입력하고 생성하세요.";
  imagebotElements.status.className = "imagebot-status";
}

function setGenerating(generating) {
  isGenerating = generating;
  imagebotElements.generateBtn.disabled = generating;
  imagebotElements.promptInput.disabled = generating;
  imagebotElements.generateBtn.textContent = generating ? "생성 중..." : "이미지 생성";
}

function getErrorMessage(error) {
  if (error.message === "API_KEY_MISSING") {
    return "API 키가 설정되지 않았습니다. MLB AI 챗봇에서 API 키를 먼저 저장해 주세요.";
  }
  if (error.message.includes("Incorrect API key")) {
    return "API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.";
  }
  if (error.message.includes("insufficient_quota")) {
    return "OpenAI 사용 한도가 초과되었습니다. 계정 크레딧을 확인해 주세요.";
  }
  if (error.message.includes("content_policy")) {
    return "프롬프트가 콘텐츠 정책에 위배됩니다. 다른 설명으로 다시 시도해 주세요.";
  }
  if (error.message.includes("Failed to fetch")) {
    return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.";
  }
  return error.message || "이미지 생성 중 오류가 발생했습니다.";
}

async function callImageAPI(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  // gpt-image 모델: model + prompt만 전송 (response_format, output_format 등 미지원)
  const requestBody = {
    model: OpenAIConfig.getImageModel(),
    prompt: prompt.trim(),
    n: 1,
  };

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.message || `API 오류 (${response.status})`;
    throw new Error(errMsg);
  }

  const image = data.data?.[0];
  if (!image) {
    throw new Error("이미지 데이터를 받지 못했습니다.");
  }

  if (image.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }

  if (image.url) {
    return image.url;
  }

  throw new Error("이미지 데이터 형식을 인식하지 못했습니다.");
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function renderGallery() {
  imagebotElements.gallery.querySelectorAll(".imagebot-card").forEach((el) => el.remove());

  if (generatedImages.length === 0) {
    imagebotElements.galleryEmpty.hidden = false;
    return;
  }

  imagebotElements.galleryEmpty.hidden = true;

  generatedImages.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "imagebot-card";
    article.dataset.index = String(index);
    article.innerHTML = `
      <button type="button" class="imagebot-card-preview" aria-label="이미지 크게 보기">
        <img src="${item.dataUrl}" alt="${escapeHtml(item.prompt)}" loading="lazy" />
      </button>
      <div class="imagebot-card-body">
        <p class="imagebot-card-prompt">${escapeHtml(item.prompt)}</p>
        <div class="imagebot-card-meta">
          <span>${formatTime(item.createdAt)}</span>
          <button type="button" class="imagebot-download-btn" data-index="${index}">다운로드</button>
        </div>
      </div>
    `;
    imagebotElements.gallery.appendChild(article);
  });
}

function openLightbox(index) {
  const item = generatedImages[index];
  if (!item) return;

  activeLightboxIndex = index;
  imagebotElements.lightboxImg.src = item.dataUrl;
  imagebotElements.lightboxCaption.textContent = item.prompt;
  imagebotElements.lightbox.hidden = false;
}

function closeLightbox() {
  activeLightboxIndex = -1;
  imagebotElements.lightbox.hidden = true;
  imagebotElements.lightboxImg.src = "";
}

async function generateImage(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed || isGenerating) return;

  if (!getApiKey()) {
    imagebotElements.status.textContent = getErrorMessage(new Error("API_KEY_MISSING"));
    imagebotElements.status.className = "imagebot-status error";
    return;
  }

  setGenerating(true);
  imagebotElements.status.textContent = "이미지를 생성하는 중입니다. 잠시만 기다려 주세요...";
  imagebotElements.status.className = "imagebot-status loading";

  try {
    const dataUrl = await callImageAPI(trimmed);
    generatedImages.unshift({
      prompt: trimmed,
      dataUrl,
      createdAt: new Date(),
    });

    if (generatedImages.length > 20) {
      generatedImages = generatedImages.slice(0, 20);
    }

    renderGallery();
    imagebotElements.status.textContent = "이미지가 생성되었습니다. 갤러리에서 확인하세요.";
    imagebotElements.status.className = "imagebot-status success";
    imagebotElements.promptInput.value = "";
  } catch (error) {
    imagebotElements.status.textContent = getErrorMessage(error);
    imagebotElements.status.className = "imagebot-status error";
  } finally {
    setGenerating(false);
    imagebotElements.promptInput.focus();
  }
}

imagebotElements.toggle.addEventListener("click", openPanel);
imagebotElements.closeBtn.addEventListener("click", closePanel);

imagebotElements.form.addEventListener("submit", (e) => {
  e.preventDefault();
  generateImage(imagebotElements.promptInput.value);
});

imagebotElements.gallery.addEventListener("click", (e) => {
  const preview = e.target.closest(".imagebot-card-preview");
  if (preview) {
    const card = preview.closest(".imagebot-card");
    openLightbox(Number(card.dataset.index));
    return;
  }

  const downloadBtn = e.target.closest(".imagebot-download-btn");
  if (downloadBtn) {
    const index = Number(downloadBtn.dataset.index);
    const item = generatedImages[index];
    if (item) {
      downloadImage(item.dataUrl, `generated-${Date.now()}.png`);
    }
  }
});

imagebotElements.lightboxClose.addEventListener("click", closeLightbox);

imagebotElements.lightbox.addEventListener("click", (e) => {
  if (e.target === imagebotElements.lightbox) closeLightbox();
});

imagebotElements.lightboxDownload.addEventListener("click", () => {
  const item = generatedImages[activeLightboxIndex];
  if (item) {
    downloadImage(item.dataUrl, `generated-${Date.now()}.png`);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!imagebotElements.lightbox.hidden) {
      closeLightbox();
    } else if (!imagebotElements.panel.hidden) {
      closePanel();
    }
  }
});

renderGallery();
