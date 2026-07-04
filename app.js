const API_BASE = "https://statsapi.mlb.com/api/v1/schedule";
const STANDINGS_API = "https://statsapi.mlb.com/api/v1/standings";
const GAME_FEED_API = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
const TEAM_ROSTER_API = (teamId, season) =>
  `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${season}`;
const TEAM_LOGO = (id) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const LEADERS_API = "https://statsapi.mlb.com/api/v1/stats/leaders";
const PLAYER_HEADSHOT = (id) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${id}/headshot/67/current`;

const LEAGUE_NL = 104;
const LEAGUE_AL = 103;

const DIVISION_ORDER = {
  [LEAGUE_NL]: [204, 205, 203],
  [LEAGUE_AL]: [201, 202, 200],
};

const HITTING_LEADER_CATEGORIES = [
  { key: "homeRuns", label: "홈런" },
  { key: "battingAverage", label: "타율" },
  { key: "runsBattedIn", label: "타점" },
  { key: "runs", label: "득점" },
];

const PITCHING_LEADER_CATEGORIES = [
  { key: "earnedRunAverage", label: "ERA" },
  { key: "wins", label: "승" },
  { key: "strikeouts", label: "탈삼진" },
  { key: "saves", label: "세이브" },
];

const STATUS_KO = {
  Scheduled: "예정",
  "Pre-Game": "경기 전",
  Warmup: "워밍업",
  "In Progress": "진행 중",
  "Delayed Start": "시작 지연",
  Delayed: "지연",
  "Manager Challenge": "챌린지",
  Suspended: "중단",
  Final: "종료",
  "Game Over": "종료",
  "Completed Early": "조기 종료",
  "Completed Early: Rain": "우천 취소",
  Postponed: "연기",
  Cancelled: "취소",
  Preview: "예정",
};

const elements = {
  dateInput: document.getElementById("dateInput"),
  displayDate: document.getElementById("displayDate"),
  prevDayBtn: document.getElementById("prevDayBtn"),
  nextDayBtn: document.getElementById("nextDayBtn"),
  todayBtn: document.getElementById("todayBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  retryBtn: document.getElementById("retryBtn"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  emptyState: document.getElementById("emptyState"),
  gamesContainer: document.getElementById("gamesContainer"),
  summary: document.getElementById("summary"),
  totalGames: document.getElementById("totalGames"),
  liveGames: document.getElementById("liveGames"),
  finalGames: document.getElementById("finalGames"),
  scheduledGames: document.getElementById("scheduledGames"),
  seasonBadge: document.getElementById("seasonBadge"),
  nlStandings: document.getElementById("nlStandings"),
  alStandings: document.getElementById("alStandings"),
  gameModal: document.getElementById("gameModal"),
  modalContent: document.getElementById("modalContent"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

let currentDate = formatDate(new Date());
let refreshTimer = null;
let gamesByPk = new Map();
let activeModal = null;

function getCurrentSeason() {
  const fromBadge = elements.seasonBadge.textContent.match(/\d{4}/)?.[0];
  return Number(fromBadge) || new Date().getFullYear();
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDate(str, days) {
  const date = parseDate(str);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function formatDisplayDate(str) {
  const date = parseDate(str);
  const today = formatDate(new Date());
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);

  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(date);
  const full = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

  if (str === today) return `오늘 · ${full} (${weekday})`;
  if (str === yesterday) return `어제 · ${full} (${weekday})`;
  if (str === tomorrow) return `내일 · ${full} (${weekday})`;
  return `${full} (${weekday})`;
}

function formatGameTime(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatGamesBack(gb) {
  if (!gb || gb === "-") return "-";
  return gb;
}

function formatPct(pct) {
  if (!pct) return ".000";
  const num = parseFloat(pct);
  if (Number.isNaN(num)) return pct;
  return num.toFixed(3).replace(/^0/, "");
}

function getDivisionShortName(name) {
  if (name.includes("East")) return "동부";
  if (name.includes("Central")) return "중부";
  if (name.includes("West")) return "서부";
  return name;
}

function renderStreak(streak) {
  if (!streak?.streakCode) return "";
  const isWin = streak.streakType === "wins";
  return `<span class="streak ${isWin ? "win" : "loss"}">${streak.streakCode}</span>`;
}

function renderStandingsRow(teamRecord) {
  const team = teamRecord.team;
  const wins = teamRecord.wins ?? teamRecord.leagueRecord?.wins ?? 0;
  const losses = teamRecord.losses ?? teamRecord.leagueRecord?.losses ?? 0;
  const isLeader = teamRecord.divisionLeader || teamRecord.divisionRank === "1";

  return `
    <tr
      class="standings-team-row team-link ${isLeader ? "leader" : ""}"
      data-team-id="${team.id}"
      data-team-name="${team.name}"
      tabindex="0"
      role="button"
      aria-label="${team.name} 선수 명단 보기"
    >
      <td class="rank">${teamRecord.divisionRank}</td>
      <td class="team-col">
        <div class="team-cell">
          <img
            class="team-logo-sm"
            src="${TEAM_LOGO(team.id)}"
            alt=""
            loading="lazy"
            onerror="this.style.opacity='0.3'"
          />
          <span class="team-abbr">${team.abbreviation || team.teamName}</span>
          ${renderStreak(teamRecord.streak)}
        </div>
      </td>
      <td class="record">${wins}-${losses}</td>
      <td class="pct">${formatPct(teamRecord.winningPercentage || teamRecord.leagueRecord?.pct)}</td>
      <td class="gb">${formatGamesBack(teamRecord.gamesBack)}</td>
    </tr>
  `;
}

function renderDivisionBlock(record) {
  const teams = [...record.teamRecords].sort(
    (a, b) => Number(a.divisionRank) - Number(b.divisionRank)
  );

  return `
    <div class="division-block">
      <h3 class="division-title">${getDivisionShortName(record.division.name)}</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th class="team-col">팀</th>
            <th>전적</th>
            <th>승률</th>
            <th>GB</th>
          </tr>
        </thead>
        <tbody>
          ${teams.map(renderStandingsRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeagueStandings(records, leagueId) {
  const order = DIVISION_ORDER[leagueId];
  const byDivision = new Map(records.map((r) => [r.division.id, r]));

  return order
    .map((id) => byDivision.get(id))
    .filter(Boolean)
    .map(renderDivisionBlock)
    .join("");
}

function dedupeLeaderBlocks(blocks) {
  const map = new Map();
  for (const block of blocks || []) {
    if (!map.has(block.leaderCategory)) {
      map.set(block.leaderCategory, block);
    }
  }
  return map;
}

function formatLeaderValue(category, value) {
  if (value === undefined || value === null) return "-";
  if (category === "battingAverage") return formatAvg(value);
  if (category === "earnedRunAverage") return formatEra(value);
  return value;
}

function renderLeaderRow(leader, category) {
  const person = leader.person;
  const team = leader.team;
  if (!person) return "";

  return `
    <li class="leader-row">
      <span class="leader-rank">${leader.rank}</span>
      <img
        class="leader-photo"
        src="${PLAYER_HEADSHOT(person.id)}"
        alt=""
        loading="lazy"
      />
      <div class="leader-info">
        <span class="leader-name">${person.fullName}</span>
        <span class="leader-team">${team?.name || ""}</span>
      </div>
      <span class="leader-value">${formatLeaderValue(category, leader.value)}</span>
    </li>
  `;
}

function renderLeaderCategoryBlock(categoryKey, label, block) {
  const leaders = (block?.leaders || []).slice(0, 5);
  if (!leaders.length) return "";

  return `
    <div class="leader-category">
      <h4 class="leader-category-title">${label}</h4>
      <ol class="leader-list">
        ${leaders.map((l) => renderLeaderRow(l, categoryKey)).join("")}
      </ol>
    </div>
  `;
}

function renderLeaderGroup(title, categories, leaderBlocks) {
  const blockMap = dedupeLeaderBlocks(leaderBlocks);
  const html = categories
    .map(({ key, label }) => renderLeaderCategoryBlock(key, label, blockMap.get(key)))
    .filter(Boolean)
    .join("");

  if (!html) return "";

  return `
    <div class="leader-group">
      <h3 class="leader-group-title">${title}</h3>
      ${html}
    </div>
  `;
}

function renderLeagueLeadersSection(leadersData) {
  if (!leadersData) return "";

  const hitting = renderLeaderGroup("타자", HITTING_LEADER_CATEGORIES, leadersData.hitting);
  const pitching = renderLeaderGroup("투수", PITCHING_LEADER_CATEGORIES, leadersData.pitching);

  if (!hitting && !pitching) return "";

  return `
    <section class="leaders-section" aria-label="개인 기록 순위">
      <h3 class="leaders-section-title">개인 기록 TOP 5</h3>
      ${hitting}
      ${pitching}
    </section>
  `;
}

async function fetchLeagueLeaderGroup(leagueId, season, categories, statGroup) {
  const params = new URLSearchParams({
    leaderCategories: categories.map((c) => c.key).join(","),
    season: String(season),
    leagueId: String(leagueId),
    sportId: "1",
    statGroup,
    limit: "5",
  });

  const response = await fetch(`${LEADERS_API}?${params}`);
  if (!response.ok) throw new Error(`개인 순위 API 오류 (${response.status})`);
  const data = await response.json();
  return data.leagueLeaders || [];
}

async function fetchLeagueLeaders(leagueId, season) {
  const [hitting, pitching] = await Promise.all([
    fetchLeagueLeaderGroup(leagueId, season, HITTING_LEADER_CATEGORIES, "hitting"),
    fetchLeagueLeaderGroup(leagueId, season, PITCHING_LEADER_CATEGORIES, "pitching"),
  ]);

  return { hitting, pitching };
}

async function fetchStandings(season) {
  const params = new URLSearchParams({
    leagueId: `${LEAGUE_AL},${LEAGUE_NL}`,
    season: String(season),
    standingsTypes: "regularSeason",
    hydrate: "division,team",
  });

  const response = await fetch(`${STANDINGS_API}?${params}`);
  if (!response.ok) throw new Error(`순위 API 오류 (${response.status})`);
  return response.json();
}

async function loadStandings(season) {
  const year = season || new Date().getFullYear();

  try {
    const [data, nlLeaders, alLeaders] = await Promise.all([
      fetchStandings(year),
      fetchLeagueLeaders(LEAGUE_NL, year),
      fetchLeagueLeaders(LEAGUE_AL, year),
    ]);

    const nlRecords = data.records.filter((r) => r.league.id === LEAGUE_NL);
    const alRecords = data.records.filter((r) => r.league.id === LEAGUE_AL);

    elements.nlStandings.innerHTML =
      renderLeagueStandings(nlRecords, LEAGUE_NL) +
      renderLeagueLeadersSection(nlLeaders);
    elements.alStandings.innerHTML =
      renderLeagueStandings(alRecords, LEAGUE_AL) +
      renderLeagueLeadersSection(alLeaders);
  } catch (error) {
    const message = error.message || "순위를 불러오지 못했습니다.";
    const errorHtml = `<div class="standings-error">${message}</div>`;
    elements.nlStandings.innerHTML = errorHtml;
    elements.alStandings.innerHTML = errorHtml;
  }
}

function translateStatus(status) {
  return STATUS_KO[status] || status;
}

function getGameCategory(game) {
  const state = game.status.abstractGameState;
  if (state === "Live") return "live";
  if (state === "Final") return "final";
  return "scheduled";
}

function getScore(game, side) {
  const teamScore = game.teams[side].score;
  if (teamScore !== undefined && teamScore !== null) return teamScore;
  const linescore = game.linescore?.teams?.[side]?.runs;
  return linescore ?? null;
}

function getInningText(game) {
  const ls = game.linescore;
  if (!ls) return "";

  if (game.status.abstractGameState === "Final") {
    return ls.innings?.length ? `${ls.innings.length}이닝` : "종료";
  }

  if (game.status.abstractGameState === "Live" && ls.currentInning) {
    const half = ls.isTopInning ? "초" : "말";
    return `${ls.currentInning}회${half}`;
  }

  return "";
}

function getWinnerSide(game) {
  const away = getScore(game, "away");
  const home = getScore(game, "home");
  if (away === null || home === null) return null;
  if (away > home) return "away";
  if (home > away) return "home";
  return null;
}

function renderTeamRow(side, game, winnerSide) {
  const teamData = game.teams[side];
  const team = teamData.team;
  const score = getScore(game, side);
  const hasScore = score !== null;
  const isWinner = winnerSide === side;
  const isLoser = winnerSide && winnerSide !== side;

  const record = teamData.leagueRecord
    ? `${teamData.leagueRecord.wins}-${teamData.leagueRecord.losses}`
    : "";

  return `
    <div class="team ${side} ${isWinner ? "winner" : ""} ${isLoser ? "loser" : ""}">
      <button
        type="button"
        class="team-logo-btn team-link"
        data-team-id="${team.id}"
        data-team-name="${team.name}"
        aria-label="${team.name} 선수 명단 보기"
      >
        <img
          class="team-logo"
          src="${TEAM_LOGO(team.id)}"
          alt=""
          loading="lazy"
          onerror="this.style.opacity='0.3'"
        />
      </button>
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-record">${team.abbreviation} · ${record}</div>
      </div>
    </div>
  `;
}

function renderScoreBlock(game, winnerSide) {
  const away = getScore(game, "away");
  const home = getScore(game, "home");
  const category = getGameCategory(game);
  const inningText = getInningText(game);

  if (category === "scheduled" && away === null) {
    return `
      <div class="score-block">
        <div class="scores">
          <span class="score pending">-</span>
          <span class="score-divider">:</span>
          <span class="score pending">-</span>
        </div>
        <div class="inning-info">${formatGameTime(game.gameDate)}</div>
      </div>
    `;
  }

  const awayClass = winnerSide === "away" ? "winner" : winnerSide ? "loser" : "";
  const homeClass = winnerSide === "home" ? "winner" : winnerSide ? "loser" : "";

  return `
    <div class="score-block">
      <div class="scores">
        <span class="score ${awayClass}">${away ?? 0}</span>
        <span class="score-divider">-</span>
        <span class="score ${homeClass}">${home ?? 0}</span>
      </div>
      ${inningText ? `<div class="inning-info">${inningText}</div>` : ""}
    </div>
  `;
}

function renderPitchers(game) {
  const away = game.teams.away.probablePitcher?.fullName;
  const home = game.teams.home.probablePitcher?.fullName;
  if (!away && !home) return "";

  const parts = [];
  if (away) parts.push(`<span><span class="pitcher-label">원정</span> ${away}</span>`);
  if (home) parts.push(`<span><span class="pitcher-label">홈</span> ${home}</span>`);
  return parts.join("");
}

function renderGameCard(game) {
  const category = getGameCategory(game);
  const status = game.status.detailedState;
  const statusKo = translateStatus(status);
  const winnerSide = category === "final" ? getWinnerSide(game) : null;

  const statusClass =
    category === "live" ? "live" : category === "final" ? "final" : "scheduled";

  const liveIndicator =
    category === "live" ? '<span class="live-pulse"></span>' : "";

  const pitchers = renderPitchers(game);
  const venue = game.venue?.name || "";
  const series = game.seriesDescription || "";
  const gameType = game.gameType === "R" ? "정규시즌" : game.gameType;

  return `
    <article
      class="game-card game-card-clickable ${category === "live" ? "is-live" : ""}"
      data-game-pk="${game.gamePk}"
      tabindex="0"
      role="button"
      aria-label="${game.teams.away.team.name} vs ${game.teams.home.team.name} 경기 상세 보기"
    >
      <div class="game-card-header">
        <span class="game-status ${statusClass}">
          ${liveIndicator}
          ${statusKo}
        </span>
        <span>${series} · ${gameType}</span>
      </div>
      <div class="game-body">
        <div class="matchup">
          ${renderTeamRow("away", game, winnerSide)}
          ${renderScoreBlock(game, winnerSide)}
          ${renderTeamRow("home", game, winnerSide)}
        </div>
      </div>
      <div class="game-footer">
        ${venue ? `<span>📍 ${venue}</span>` : ""}
        ${pitchers}
      </div>
    </article>
  `;
}

function renderSection(title, dotClass, games) {
  if (!games.length) return "";

  return `
    <section class="game-section">
      <h2 class="section-title">
        <span class="section-dot ${dotClass}"></span>
        ${title}
        <span style="color: var(--text-muted); font-weight: 400;">(${games.length})</span>
      </h2>
      <div class="game-list">
        ${games.map(renderGameCard).join("")}
      </div>
    </section>
  `;
}

function updateSummary(games) {
  const live = games.filter((g) => getGameCategory(g) === "live").length;
  const final = games.filter((g) => getGameCategory(g) === "final").length;
  const scheduled = games.filter((g) => getGameCategory(g) === "scheduled").length;

  elements.totalGames.textContent = games.length;
  elements.liveGames.textContent = live;
  elements.finalGames.textContent = final;
  elements.scheduledGames.textContent = scheduled;
  elements.summary.hidden = games.length === 0;
}

function setView(state) {
  elements.loadingState.hidden = state !== "loading";
  elements.errorState.hidden = state !== "error";
  elements.emptyState.hidden = state !== "empty";
  elements.gamesContainer.hidden = state !== "games";
}

async function fetchSchedule(date) {
  const params = new URLSearchParams({
    sportId: "1",
    date,
    hydrate: "team,linescore,probablePitcher",
  });

  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) throw new Error(`API 오류 (${response.status})`);
  return response.json();
}

function scheduleAutoRefresh(games) {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  const hasLive = games.some((g) => getGameCategory(g) === "live");
  if (hasLive) {
    refreshTimer = setInterval(() => loadSchedule(currentDate, true), 60000);
  }
}

async function loadSchedule(date, silent = false) {
  if (!silent) setView("loading");

  try {
    const data = await fetchSchedule(date);
    const dateEntry = data.dates?.[0];
    const games = dateEntry?.games || [];

    if (games.length > 0 && games[0].season) {
      elements.seasonBadge.textContent = `${games[0].season} 시즌`;
      loadStandings(games[0].season);
    }

    elements.displayDate.textContent = formatDisplayDate(date);
    updateSummary(games);
    scheduleAutoRefresh(games);

    if (games.length === 0) {
      setView("empty");
      elements.gamesContainer.innerHTML = "";
      return;
    }

    const live = games.filter((g) => getGameCategory(g) === "live");
    const scheduled = games.filter((g) => getGameCategory(g) === "scheduled");
    const final = games.filter((g) => getGameCategory(g) === "final");

    gamesByPk = new Map(games.map((g) => [g.gamePk, g]));

    elements.gamesContainer.innerHTML =
      renderSection("진행 중", "live", live) +
      renderSection("예정", "scheduled", scheduled) +
      renderSection("종료", "final", final);

    setView("games");
  } catch (error) {
    elements.errorMessage.textContent =
      error.message || "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    setView("error");
  }
}

function goToDate(date) {
  currentDate = date;
  elements.dateInput.value = date;
  loadSchedule(date);
}

async function fetchGameFeed(gamePk) {
  const response = await fetch(GAME_FEED_API(gamePk));
  if (!response.ok) throw new Error(`경기 상세 API 오류 (${response.status})`);
  return response.json();
}

function renderPlayerPhoto(personId, name) {
  return `
    <img
      class="player-photo"
      src="${PLAYER_HEADSHOT(personId)}"
      alt="${name}"
      loading="lazy"
    />
  `;
}

function getPlayer(players, personId) {
  return players[`ID${personId}`] || null;
}

function renderBattingRow(order, personId, players) {
  const player = getPlayer(players, personId);
  if (!player) return "";

  const name = player.person?.fullName || "";
  const pos = player.position?.abbreviation || "";
  const stats = player.stats?.batting || {};
  const summary = stats.summary || "";

  return `
    <tr>
      <td>${order}</td>
      <td class="name-col">
        <div class="player-cell">
          ${renderPlayerPhoto(player.person.id, name)}
          <div>
            <span class="player-name">${name}</span>
            <span class="player-pos">${pos}${player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}</span>
            ${summary ? `<span class="player-summary">${summary}</span>` : ""}
          </div>
        </div>
      </td>
      <td>${stats.atBats ?? "-"}</td>
      <td>${stats.hits ?? "-"}</td>
      <td>${stats.runs ?? "-"}</td>
      <td>${stats.rbi ?? "-"}</td>
      <td>${stats.baseOnBalls ?? "-"}</td>
      <td>${stats.strikeOuts ?? "-"}</td>
    </tr>
  `;
}

function renderPitchingRow(personId, players) {
  const player = getPlayer(players, personId);
  if (!player) return "";

  const name = player.person?.fullName || "";
  const stats = player.stats?.pitching || {};
  const summary = stats.summary || "";
  const decision = player.pitchingDecision ? ` (${player.pitchingDecision})` : "";

  return `
    <tr>
      <td class="name-col">
        <div class="player-cell">
          ${renderPlayerPhoto(player.person.id, name)}
          <div>
            <span class="player-name">${name}${decision}</span>
            ${summary ? `<span class="player-summary">${summary}</span>` : ""}
          </div>
        </div>
      </td>
      <td>${stats.inningsPitched ?? "-"}</td>
      <td>${stats.hits ?? "-"}</td>
      <td>${stats.runs ?? "-"}</td>
      <td>${stats.earnedRuns ?? "-"}</td>
      <td>${stats.baseOnBalls ?? "-"}</td>
      <td>${stats.strikeOuts ?? "-"}</td>
    </tr>
  `;
}

function renderPlayerTableSection(title, rowsHtml, type) {
  if (!rowsHtml) return "";

  const battingHeaders = `
    <tr>
      <th>#</th>
      <th class="name-col">타자</th>
      <th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>SO</th>
    </tr>
  `;

  const pitchingHeaders = `
    <tr>
      <th class="name-col">투수</th>
      <th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th>
    </tr>
  `;

  return `
    <div>
      <h4 class="subsection-title">${title}</h4>
      <table class="player-table">
        <thead>${type === "pitching" ? pitchingHeaders : battingHeaders}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function renderTeamPanel(side, feed, scheduleGame) {
  const boxTeam = feed.liveData?.boxscore?.teams?.[side];
  const team = scheduleGame.teams[side].team;
  const linescoreTeam = feed.liveData?.linescore?.teams?.[side];

  if (!boxTeam?.players || !boxTeam.battingOrder?.length) {
    const probable = scheduleGame.teams[side].probablePitcher?.fullName;
    return `
      <div class="team-panel">
        <div class="team-panel-header">
          <img src="${TEAM_LOGO(team.id)}" alt="" />
          ${team.name}
        </div>
        <div class="modal-empty" style="padding: 24px 12px;">
          <p>라인업이 아직 확정되지 않았습니다.</p>
          ${probable ? `<p class="modal-empty-note">예상 선발: ${probable}</p>` : ""}
        </div>
      </div>
    `;
  }

  const starters = new Set(boxTeam.battingOrder);
  const lineupRows = boxTeam.battingOrder
    .map((id, i) => renderBattingRow(i + 1, id, boxTeam.players))
    .join("");

  const benchRows = (boxTeam.batters || [])
    .filter((id) => !starters.has(id))
    .map((id) => renderBattingRow("-", id, boxTeam.players))
    .join("");

  const pitchingRows = (boxTeam.pitchers || [])
    .map((id) => renderPitchingRow(id, boxTeam.players))
    .join("");

  const runs = linescoreTeam?.runs ?? getScore(scheduleGame, side) ?? "-";
  const hits = linescoreTeam?.hits ?? "-";
  const errors = linescoreTeam?.errors ?? "-";

  return `
    <div class="team-panel">
      <div class="team-panel-header">
        <img src="${TEAM_LOGO(team.id)}" alt="" />
        ${team.name}
        <span style="margin-left: auto; font-size: 0.78rem; color: var(--text-muted);">
          R ${runs} · H ${hits} · E ${errors}
        </span>
      </div>
      ${renderPlayerTableSection("타순", lineupRows, "batting")}
      ${renderPlayerTableSection("대타·대주자", benchRows, "batting")}
      ${renderPlayerTableSection("투수", pitchingRows, "pitching")}
    </div>
  `;
}

function renderLinescoreTable(feed, scheduleGame) {
  const innings = feed.liveData?.linescore?.innings || [];
  const awayTeam = scheduleGame.teams.away.team;
  const homeTeam = scheduleGame.teams.home.team;
  const awayTotals = feed.liveData?.linescore?.teams?.away || {};
  const homeTotals = feed.liveData?.linescore?.teams?.home || {};

  if (!innings.length) {
    const awayScore = getScore(scheduleGame, "away");
    const homeScore = getScore(scheduleGame, "home");
    if (awayScore === null) {
      return `<p class="modal-empty-note">경기 시작 전입니다. 이닝별 스코어는 경기 시작 후 표시됩니다.</p>`;
    }
    return `
      <table class="linescore-table">
        <tbody>
          <tr>
            <td class="team-label">${awayTeam.abbreviation}</td>
            <td class="total-col">${awayScore}</td>
          </tr>
          <tr>
            <td class="team-label">${homeTeam.abbreviation}</td>
            <td class="total-col">${homeScore}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  const maxInning = Math.max(9, ...innings.map((i) => i.num));
  const inningHeaders = Array.from({ length: maxInning }, (_, i) => i + 1);

  const awayInningCells = inningHeaders
    .map((num) => {
      const inning = innings.find((i) => i.num === num);
      const runs = inning?.away?.runs;
      return `<td>${runs !== undefined ? runs : ""}</td>`;
    })
    .join("");

  const homeInningCells = inningHeaders
    .map((num) => {
      const inning = innings.find((i) => i.num === num);
      const runs = inning?.home?.runs;
      return `<td>${runs !== undefined ? runs : ""}</td>`;
    })
    .join("");

  const headerCells = inningHeaders.map((n) => `<th>${n}</th>`).join("");

  return `
    <div class="linescore-wrap">
      <table class="linescore-table">
        <thead>
          <tr>
            <th class="team-label">팀</th>
            ${headerCells}
            <th class="total-col">R</th>
            <th class="total-col">H</th>
            <th class="total-col">E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="team-label">${awayTeam.abbreviation}</td>
            ${awayInningCells}
            <td class="total-col">${awayTotals.runs ?? 0}</td>
            <td class="total-col">${awayTotals.hits ?? 0}</td>
            <td class="total-col">${awayTotals.errors ?? 0}</td>
          </tr>
          <tr>
            <td class="team-label">${homeTeam.abbreviation}</td>
            ${homeInningCells}
            <td class="total-col">${homeTotals.runs ?? 0}</td>
            <td class="total-col">${homeTotals.hits ?? 0}</td>
            <td class="total-col">${homeTotals.errors ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderDecisions(decisions) {
  if (!decisions) return "";
  const parts = [];
  if (decisions.winner) parts.push(`<span><strong>승</strong> ${decisions.winner.fullName}</span>`);
  if (decisions.loser) parts.push(`<span><strong>패</strong> ${decisions.loser.fullName}</span>`);
  if (decisions.save) parts.push(`<span><strong>세이브</strong> ${decisions.save.fullName}</span>`);
  if (!parts.length) return "";
  return `<div class="decisions">${parts.join("")}</div>`;
}

function renderGameDetail(feed, scheduleGame) {
  const away = scheduleGame.teams.away.team;
  const home = scheduleGame.teams.home.team;
  const awayScore = getScore(scheduleGame, "away") ?? feed.liveData?.linescore?.teams?.away?.runs ?? "-";
  const homeScore = getScore(scheduleGame, "home") ?? feed.liveData?.linescore?.teams?.home?.runs ?? "-";
  const status = translateStatus(
    feed.gameData?.status?.detailedState || scheduleGame.status.detailedState
  );
  const venue = scheduleGame.venue?.name || feed.gameData?.venue?.name || "";
  const gameTime = formatGameTime(scheduleGame.gameDate);
  const inningText = getInningText({
    status: scheduleGame.status,
    linescore: feed.liveData?.linescore || scheduleGame.linescore,
  });

  return `
    <div class="modal-header">
      <div class="modal-matchup">
        <div class="modal-team">
          <img class="modal-team-logo" src="${TEAM_LOGO(away.id)}" alt="" />
          <span class="modal-team-name">${away.name}</span>
        </div>
        <span class="modal-score">${awayScore} - ${homeScore}</span>
        <div class="modal-team">
          <img class="modal-team-logo" src="${TEAM_LOGO(home.id)}" alt="" />
          <span class="modal-team-name">${home.name}</span>
        </div>
      </div>
      <div class="modal-meta">
        <span>${status}</span>
        ${inningText ? `<span>${inningText}</span>` : `<span>${gameTime}</span>`}
        ${venue ? `<span>${venue}</span>` : ""}
      </div>
    </div>

    <section class="modal-section">
      <h3 class="modal-section-title">이닝별 스코어보드</h3>
      ${renderLinescoreTable(feed, scheduleGame)}
      ${renderDecisions(feed.liveData?.decisions)}
    </section>

    <section class="modal-section">
      <h3 class="modal-section-title">선수 라인업 &amp; 기록</h3>
      <div class="lineup-grid">
        ${renderTeamPanel("away", feed, scheduleGame)}
        ${renderTeamPanel("home", feed, scheduleGame)}
      </div>
    </section>
  `;
}

function openGameModal(gamePk) {
  const scheduleGame = gamesByPk.get(gamePk);
  if (!scheduleGame) return;

  activeModal = { type: "game", id: gamePk };
  showModalLoading("경기 상세 정보를 불러오는 중...");

  fetchGameFeed(gamePk)
    .then((feed) => {
      if (activeModal?.type !== "game" || activeModal.id !== gamePk) return;
      elements.modalContent.innerHTML = renderGameDetail(feed, scheduleGame);
    })
    .catch((error) => {
      if (activeModal?.type !== "game" || activeModal.id !== gamePk) return;
      showModalError(error.message, () => openGameModal(gamePk));
    });
}

async function fetchTeamRoster(teamId, season) {
  const response = await fetch(TEAM_ROSTER_API(teamId, season));
  if (!response.ok) throw new Error(`로스터 API 오류 (${response.status})`);
  const data = await response.json();
  return data.roster || [];
}

async function fetchPeopleSeasonStats(personIds, season) {
  if (!personIds.length) return [];

  const hydrate = `stats(group=[hitting,pitching],type=season,season=${season})`;
  const url = `https://statsapi.mlb.com/api/v1/people?personIds=${personIds.join(",")}&hydrate=${encodeURIComponent(hydrate)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`선수 기록 API 오류 (${response.status})`);
  const data = await response.json();
  return data.people || [];
}

function getSeasonStat(person, group) {
  const entry = person.stats?.find((s) => s.group?.displayName === group);
  return entry?.splits?.[0]?.stat || null;
}

function formatAvg(value) {
  if (value === undefined || value === null || value === "") return "-";
  const str = String(value);
  return str.startsWith(".") ? str : Number(value).toFixed(3).replace(/^0/, ".");
}

function formatEra(value) {
  if (value === undefined || value === null || value === "") return "-";
  return Number(value).toFixed(2);
}

function mergeRosterWithStats(roster, people) {
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  return roster.map((entry) => {
    const detail = peopleMap.get(entry.person.id);
    return {
      ...entry,
      person: detail || entry.person,
    };
  });
}

function isTwoWayPlayer(entry) {
  return !!(
    getSeasonStat(entry.person, "hitting")?.gamesPlayed &&
    getSeasonStat(entry.person, "pitching")?.gamesPlayed
  );
}

function twoWayBadge(entry) {
  return isTwoWayPlayer(entry)
    ? `<span class="two-way-badge">투타겸업</span>`
    : "";
}

function renderRosterHitterRow(entry) {
  const person = entry.person;
  const stats = getSeasonStat(person, "hitting");
  const name = person.fullName || entry.person.fullName;
  const pos = entry.position?.abbreviation || "-";
  const number = entry.jerseyNumber || person.primaryNumber || "";

  if (!stats?.gamesPlayed) return "";

  return `
    <tr>
      <td class="name-col">
        <div class="player-cell">
          ${renderPlayerPhoto(person.id, name)}
          <div>
            <span class="player-name">${name} ${twoWayBadge(entry)}</span>
            <span class="player-pos">${pos}${number ? ` · #${number}` : ""}</span>
          </div>
        </div>
      </td>
      <td>${stats.gamesPlayed ?? "-"}</td>
      <td>${formatAvg(stats.avg)}</td>
      <td>${stats.hits ?? "-"}</td>
      <td>${stats.homeRuns ?? "-"}</td>
      <td>${stats.rbi ?? "-"}</td>
      <td>${stats.runs ?? "-"}</td>
      <td>${stats.strikeOuts ?? "-"}</td>
      <td>${stats.ops ? formatAvg(stats.ops) : "-"}</td>
    </tr>
  `;
}

function renderRosterPitcherRow(entry) {
  const person = entry.person;
  const stats = getSeasonStat(person, "pitching");
  const name = person.fullName || entry.person.fullName;
  const number = entry.jerseyNumber || person.primaryNumber || "";

  if (!stats?.gamesPlayed) return "";

  const record = `${stats.wins ?? 0}-${stats.losses ?? 0}`;

  return `
    <tr>
      <td class="name-col">
        <div class="player-cell">
          ${renderPlayerPhoto(person.id, name)}
          <div>
            <span class="player-name">${name} ${twoWayBadge(entry)}</span>
            <span class="player-pos">P${number ? ` · #${number}` : ""}</span>
          </div>
        </div>
      </td>
      <td>${stats.gamesPlayed ?? "-"}</td>
      <td>${record}</td>
      <td>${formatEra(stats.era)}</td>
      <td>${stats.inningsPitched ?? "-"}</td>
      <td>${stats.strikeOuts ?? "-"}</td>
      <td>${stats.baseOnBalls ?? "-"}</td>
      <td>${stats.whip ? formatEra(stats.whip) : "-"}</td>
    </tr>
  `;
}

function renderRosterStatsTable(title, headers, rowsHtml) {
  if (!rowsHtml) {
    return `
      <section class="modal-section">
        <h3 class="modal-section-title">${title}</h3>
        <p class="modal-empty-note">표시할 기록이 없습니다.</p>
      </section>
    `;
  }

  return `
    <section class="modal-section">
      <h3 class="modal-section-title">${title}</h3>
      <div class="linescore-wrap">
        <table class="player-table roster-stats-table">
          <thead>${headers}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTeamRosterDetail(rosterEntries, teamName, teamId, season) {
  const hitters = rosterEntries
    .filter((e) => getSeasonStat(e.person, "hitting")?.gamesPlayed)
    .sort(
      (a, b) =>
        (getSeasonStat(b.person, "hitting")?.gamesPlayed || 0) -
        (getSeasonStat(a.person, "hitting")?.gamesPlayed || 0)
    );

  const pitchers = rosterEntries
    .filter((e) => getSeasonStat(e.person, "pitching")?.gamesPlayed)
    .sort(
      (a, b) =>
        (getSeasonStat(b.person, "pitching")?.gamesPlayed || 0) -
        (getSeasonStat(a.person, "pitching")?.gamesPlayed || 0)
    );

  const twoWay = rosterEntries.filter(isTwoWayPlayer);

  const hitterRows = hitters.map(renderRosterHitterRow).join("");
  const pitcherRows = pitchers.map(renderRosterPitcherRow).join("");

  const hitterHeaders = `
    <tr>
      <th class="name-col">선수</th>
      <th>G</th><th>AVG</th><th>H</th><th>HR</th><th>RBI</th><th>R</th><th>SO</th><th>OPS</th>
    </tr>
  `;

  const pitcherHeaders = `
    <tr>
      <th class="name-col">선수</th>
      <th>G</th><th>W-L</th><th>ERA</th><th>IP</th><th>SO</th><th>BB</th><th>WHIP</th>
    </tr>
  `;

  return `
    <div class="modal-header team-roster-header">
      <div class="modal-matchup">
        <div class="modal-team">
          <img class="modal-team-logo" src="${TEAM_LOGO(teamId)}" alt="" />
          <div>
            <h2 class="modal-team-name" id="modalTitle">${teamName}</h2>
            <p class="modal-meta" style="margin-top:4px;">${season} 시즌 소속 선수 · 올해 기록</p>
          </div>
        </div>
      </div>
      <div class="modal-meta">
        <span>활성 로스터 ${rosterEntries.length}명</span>
        <span>타자 ${hitters.length}명</span>
        <span>투수 ${pitchers.length}명</span>
        ${twoWay.length ? `<span>투타겸업 ${twoWay.length}명</span>` : ""}
      </div>
    </div>

    ${renderRosterStatsTable("타자 기록", hitterHeaders, hitterRows)}
    ${renderRosterStatsTable("투수 기록", pitcherHeaders, pitcherRows)}
  `;
}

async function openTeamModal(teamId, teamName) {
  const season = getCurrentSeason();
  activeModal = { type: "team", id: teamId, name: teamName };
  showModalLoading("팀 선수 명단을 불러오는 중...");

  try {
    const roster = await fetchTeamRoster(teamId, season);
    const personIds = roster.map((r) => r.person.id);
    const people = await fetchPeopleSeasonStats(personIds, season);

    if (activeModal?.type !== "team" || activeModal.id !== teamId) return;

    const merged = mergeRosterWithStats(roster, people);
    elements.modalContent.innerHTML = renderTeamRosterDetail(
      merged,
      teamName,
      teamId,
      season
    );
  } catch (error) {
    if (activeModal?.type !== "team" || activeModal.id !== teamId) return;
    showModalError(error.message, () => openTeamModal(teamId, teamName));
  }
}

function showModalLoading(message) {
  elements.gameModal.hidden = false;
  document.body.style.overflow = "hidden";
  elements.modalContent.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function showModalError(message, onRetry) {
  elements.modalContent.innerHTML = `
    <div class="modal-empty">
      <p style="color: #f87171;">${message || "정보를 불러오지 못했습니다."}</p>
      <button type="button" class="btn-retry" id="modalRetryBtn">다시 시도</button>
    </div>
  `;
  document.getElementById("modalRetryBtn")?.addEventListener("click", onRetry);
}

function closeModal() {
  activeModal = null;
  elements.gameModal.hidden = true;
  document.body.style.overflow = "";
  elements.modalContent.innerHTML = "";
}

function handleTeamLinkActivate(link) {
  const teamId = Number(link.dataset.teamId);
  const teamName = link.dataset.teamName;
  if (!teamId || !teamName) return;
  openTeamModal(teamId, teamName);
}

elements.dateInput.value = currentDate;
elements.displayDate.textContent = formatDisplayDate(currentDate);

elements.dateInput.addEventListener("change", (e) => {
  goToDate(e.target.value);
});

elements.prevDayBtn.addEventListener("click", () => {
  goToDate(shiftDate(currentDate, -1));
});

elements.nextDayBtn.addEventListener("click", () => {
  goToDate(shiftDate(currentDate, 1));
});

elements.todayBtn.addEventListener("click", () => {
  goToDate(formatDate(new Date()));
});

elements.refreshBtn.addEventListener("click", () => {
  loadSchedule(currentDate);
  const season = elements.seasonBadge.textContent.match(/\d{4}/)?.[0];
  loadStandings(season || new Date().getFullYear());
});

elements.retryBtn.addEventListener("click", () => {
  loadSchedule(currentDate);
});

elements.gamesContainer.addEventListener("click", (e) => {
  if (e.target.closest(".team-link")) return;
  const card = e.target.closest(".game-card-clickable");
  if (!card) return;
  openGameModal(Number(card.dataset.gamePk));
});

elements.gamesContainer.addEventListener("keydown", (e) => {
  if (e.target.closest(".team-link")) return;
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".game-card-clickable");
  if (!card) return;
  e.preventDefault();
  openGameModal(Number(card.dataset.gamePk));
});

document.addEventListener("click", (e) => {
  const link = e.target.closest(".team-link");
  if (!link) return;
  e.preventDefault();
  e.stopPropagation();
  handleTeamLinkActivate(link);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const link = e.target.closest(".team-link");
  if (!link) return;
  e.preventDefault();
  e.stopPropagation();
  handleTeamLinkActivate(link);
});

elements.modalCloseBtn.addEventListener("click", closeModal);

elements.gameModal.addEventListener("click", (e) => {
  if (e.target === elements.gameModal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !elements.gameModal.hidden) closeModal();
});

loadSchedule(currentDate);
loadStandings(new Date().getFullYear());
