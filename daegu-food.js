const LOCAL_DATA_BASE = "data/daegu";

const DISTRICTS = [
  { id: "jung", name: "중구" },
  { id: "dong", name: "동구" },
  { id: "seo", name: "서구" },
  { id: "nam", name: "남구" },
  { id: "buk", name: "북구" },
  { id: "suseong", name: "수성구" },
  { id: "dalseo", name: "달서구" },
  { id: "dalseong", name: "달성군" },
];

const elements = {
  districtGrid: document.getElementById("districtGrid"),
  selectedDistrictLabel: document.getElementById("selectedDistrictLabel"),
  foodSummary: document.getElementById("foodSummary"),
  totalCount: document.getElementById("totalCount"),
  categoryCount: document.getElementById("categoryCount"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  emptyState: document.getElementById("emptyState"),
  restaurantList: document.getElementById("restaurantList"),
  retryBtn: document.getElementById("retryBtn"),
};

let selectedDistrict = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatMenu(menuHtml) {
  if (!menuHtml || menuHtml === "없음") return "";
  return menuHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function renderDistrictButtons() {
  elements.districtGrid.innerHTML = DISTRICTS.map(
    (district) => `
      <button
        type="button"
        class="daegu-district-btn"
        data-district="${district.name}"
        role="tab"
        aria-selected="false"
      >${district.name}</button>
    `
  ).join("");
}

function setActiveDistrict(name) {
  selectedDistrict = name;
  elements.districtGrid.querySelectorAll(".daegu-district-btn").forEach((btn) => {
    const isActive = btn.dataset.district === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  elements.selectedDistrictLabel.textContent = `${name} 맛집`;

  const url = new URL(window.location.href);
  url.searchParams.set("gu", name);
  history.replaceState({}, "", url);
}

function setView(state) {
  elements.loadingState.hidden = state !== "loading";
  elements.errorState.hidden = state !== "error";
  elements.emptyState.hidden = state !== "empty";
  elements.restaurantList.hidden = state !== "list";
  elements.foodSummary.hidden = state !== "list";
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function showFileProtocolWarning() {
  elements.errorMessage.innerHTML =
    "HTML 파일을 직접 열면(file://) 데이터를 불러올 수 없습니다.<br><br>" +
    "<strong>해결 방법:</strong> 폴더에서 <code>start-server.bat</code>을 더블클릭하거나 " +
    "터미널에서 <code>python server.py</code> 실행 후 " +
    "<code>http://localhost:8080/daegu-food.html</code> 로 접속하세요.";
  setView("error");
}

async function fetchRestaurants(district) {
  if (isFileProtocol()) {
    throw new Error("FILE_PROTOCOL");
  }

  const localUrl = `${LOCAL_DATA_BASE}/${encodeURIComponent(district)}.json`;
  const response = await fetch(localUrl);

  if (!response.ok) {
    throw new Error(`데이터 파일을 찾을 수 없습니다 (${district})`);
  }

  const data = await response.json();

  if (data.status !== "DONE") {
    throw new Error("맛집 데이터 형식이 올바르지 않습니다.");
  }

  return data.data || [];
}

function renderInfoRow(label, value) {
  if (!value || value === "없음" || value === "불가능") return "";
  return `
    <div class="daegu-info-row">
      <span class="daegu-info-label">${label}</span>
      <span class="daegu-info-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderRestaurantCard(item) {
  const menu = formatMenu(item.MNU);
  const menuPreview = menu
    ? menu.split("\n").slice(0, 4).join(" · ")
    : "";

  return `
    <article class="daegu-restaurant-card">
      <div class="daegu-card-header">
        <div>
          <h3 class="daegu-restaurant-name">${escapeHtml(item.BZ_NM)}</h3>
          <span class="daegu-food-category">${escapeHtml(item.FD_CS || "음식점")}</span>
        </div>
        ${item.TLNO && item.TLNO !== "없음" ? `<a class="daegu-phone" href="tel:${item.TLNO.replace(/[^0-9-]/g, "")}">${escapeHtml(item.TLNO)}</a>` : ""}
      </div>

      ${item.SMPL_DESC ? `<p class="daegu-desc">${escapeHtml(item.SMPL_DESC)}</p>` : ""}

      <div class="daegu-card-details">
        ${renderInfoRow("주소", item.GNG_CS)}
        ${renderInfoRow("영업시간", item.MBZ_HR)}
        ${renderInfoRow("좌석", item.SEAT_CNT)}
        ${renderInfoRow("주차", item.PKPL)}
        ${renderInfoRow("지하철", item.SBW)}
        ${renderInfoRow("버스", item.BUS)}
      </div>

      ${menuPreview ? `<p class="daegu-menu"><strong>메뉴</strong> ${escapeHtml(menuPreview)}</p>` : ""}

      <div class="daegu-tags">
        ${item.BKN_YN === "가능" ? '<span class="daegu-tag">예약</span>' : ""}
        ${item.BRFT_YN === "가능" ? '<span class="daegu-tag">조식</span>' : ""}
        ${item.DSSRT_YN === "가능" ? '<span class="daegu-tag">디저트</span>' : ""}
        ${item.PSB_FRN === "가능" ? '<span class="daegu-tag">외국어</span>' : ""}
      </div>
    </article>
  `;
}

function updateSummary(restaurants) {
  const categories = new Set(
    restaurants.map((r) => r.FD_CS).filter(Boolean)
  );

  elements.totalCount.textContent = restaurants.length;
  elements.categoryCount.textContent = categories.size;
}

async function loadDistrict(district) {
  setActiveDistrict(district);
  setView("loading");

  try {
    const restaurants = await fetchRestaurants(district);

    if (restaurants.length === 0) {
      setView("empty");
      elements.restaurantList.innerHTML = "";
      return;
    }

    updateSummary(restaurants);
    elements.restaurantList.innerHTML = restaurants.map(renderRestaurantCard).join("");
    setView("list");
  } catch (error) {
    if (error.message === "FILE_PROTOCOL") {
      showFileProtocolWarning();
      return;
    }
    elements.errorMessage.textContent =
      error.message || "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    setView("error");
  }
}

elements.districtGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".daegu-district-btn");
  if (!btn) return;
  loadDistrict(btn.dataset.district);
});

elements.retryBtn.addEventListener("click", () => {
  if (selectedDistrict) loadDistrict(selectedDistrict);
});

const urlDistrict = new URLSearchParams(window.location.search).get("gu");
const initialDistrict = DISTRICTS.find((d) => d.name === urlDistrict)?.name;

renderDistrictButtons();

if (isFileProtocol()) {
  document.getElementById("serverNote").hidden = false;
}

if (initialDistrict) {
  loadDistrict(initialDistrict);
} else {
  setView("empty");
  elements.emptyState.hidden = false;
  elements.emptyState.querySelector("p").textContent = "위에서 구역을 선택하면 맛집 목록이 표시됩니다.";
}
