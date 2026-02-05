const safeText = (value, fallback = "TBA") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
};

const toDateLabel = (value) => {
  if (!value) {
    return "TBA";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveTeam = (teams, id) => {
  const team = teams?.[id];
  if (!team) {
    return { name: safeText(id, "未知战队"), logo: "" };
  }
  return {
    name: safeText(team.name, "未知战队"),
    logo: safeText(team.logo, ""),
  };
};

const render = (container, match, teams) => {
  if (!match) {
    container.innerHTML = "<h2>比赛不存在</h2><p>请检查链接是否正确。</p>";
    return;
  }
  const teamA = resolveTeam(teams, match?.teams?.a);
  const teamB = resolveTeam(teams, match?.teams?.b);

  const format = safeText(match?.format, "BO?");
  const banpick = Array.isArray(match?.banpick) ? match.banpick : [];
  const maps = Array.isArray(match?.maps) ? match.maps : [];

  let scoreAValue = toNumber(match?.score?.a);
  let scoreBValue = toNumber(match?.score?.b);

  if (format.toLowerCase() === "bo1" && maps.length > 0) {
    const mapScoreA = toNumber(maps[0]?.score?.a);
    const mapScoreB = toNumber(maps[0]?.score?.b);
    if (mapScoreA !== null && mapScoreB !== null) {
      scoreAValue = mapScoreA;
      scoreBValue = mapScoreB;
    }
  }

  const scoreA = scoreAValue !== null ? String(scoreAValue) : safeText(match?.score?.a, "TBA");
  const scoreB = scoreBValue !== null ? String(scoreBValue) : safeText(match?.score?.b, "TBA");

  let scoreClassA = "score-neutral";
  let scoreClassB = "score-neutral";
  if (scoreAValue !== null && scoreBValue !== null) {
    if (scoreAValue > scoreBValue) {
      scoreClassA = "score-win";
      scoreClassB = "score-lose";
    } else if (scoreAValue < scoreBValue) {
      scoreClassA = "score-lose";
      scoreClassB = "score-win";
    }
  }

  const status = safeText(match?.status, "tba").toLowerCase();
  const statusLabel =
    status === "completed"
      ? "已完成"
      : status === "live"
      ? "进行中"
      : "未开始";

  // Aggregated Stats for "All Maps"
  const allStats = [];
  if (maps.length > 1) {
    const playerMap = new Map();
    maps.forEach(map => {
      const stats = Array.isArray(map.player_stats) ? map.player_stats : [];
      stats.forEach(ps => {
        const key = `${ps.player}-${ps.team}`;
        if (!playerMap.has(key)) {
          playerMap.set(key, { ...ps });
        } else {
          const entry = playerMap.get(key);
          entry.k = (toNumber(entry.k) || 0) + (toNumber(ps.k) || 0);
          entry.d = (toNumber(entry.d) || 0) + (toNumber(ps.d) || 0);
          entry.a = (toNumber(entry.a) || 0) + (toNumber(ps.a) || 0);
          entry.damage = (toNumber(entry.damage) || 0) + (toNumber(ps.damage) || 0);
          // If rating exists in data, average it, otherwise calculation will handle it
          if (ps.rating) {
            entry.rating = (toNumber(entry.rating) || 0) + (toNumber(ps.rating) || 0);
            entry._count = (entry._count || 1) + 1;
          }
        }
      });
    });
    playerMap.forEach(ps => {
      if (ps._count) ps.rating = ps.rating / ps._count;
      allStats.push(ps);
    });
  }

  container.innerHTML = `
    <div class="match-header-hero">
      <a href="team.html?id=${match?.teams?.a}" class="hero-team hero-team-a clickable-team">
        <img src="${teamA.logo}" alt="" onerror="this.style.display='none'" />
        <div class="hero-team-name">${teamA.name}</div>
      </a>
      <div class="hero-score-center">
        <div class="hero-score-wrap">
          <span class="hero-score ${scoreClassA}">${scoreA}</span>
          <span class="hero-score-sep">:</span>
          <span class="hero-score ${scoreClassB}">${scoreB}</span>
        </div>
        <div class="hero-status">${statusLabel}</div>
      </div>
      <a href="team.html?id=${match?.teams?.b}" class="hero-team hero-team-b clickable-team">
        <img src="${teamB.logo}" alt="" onerror="this.style.display='none'" />
        <div class="hero-team-name">${teamB.name}</div>
      </a>
    </div>
    
    <div class="match-sub-meta">
      <span>${safeText(match?.stage, "阶段未定")}</span>
      <span>${format}</span>
      <span>${toDateLabel(match?.time)}</span>
    </div>

    <div class="detail-layout-grid">
      <div class="detail-main-content">
        <div class="detail-section">
          <div class="section-header-with-tabs">
            <h3>选手数据</h3>
            <div class="map-tabs">
              ${maps.length > 1 ? `<button class="map-tab-btn active" data-map-index="all">所有地图</button>` : ""}
              ${maps.map((map, idx) => `
                <button class="map-tab-btn ${maps.length === 1 && idx === 0 ? "active" : ""}" data-map-index="${idx}">
                  ${safeText(map?.name, `Map ${idx + 1}`)}
                </button>
              `).join("")}
            </div>
          </div>
          
          <div id="stats-display-area">
            <!-- Stats tables will be rendered here by JS -->
          </div>
        </div>
      </div>

      <div class="detail-side-content">
        <div class="detail-section">
          <h3>Ban / Pick</h3>
          <ul class="detail-list small-list">
            ${
              banpick.length === 0
                ? "<li>暂无数据</li>"
                : banpick
                    .map(
                      (item) =>
                        `<li><span class="bp-team">${resolveTeam(teams, item?.team).name}</span> <span class="bp-action">${safeText(item?.action)}</span> ${safeText(
                          item?.map
                        )}</li>`
                    )
                    .join("")
            }
          </ul>
        </div>
      </div>
    </div>
  `;

  const statsArea = container.querySelector("#stats-display-area");
  
  const calculateRating = (p) => {
    if (p.rating) return toNumber(p.rating);
    const k = toNumber(p.k) || 0;
    const a = toNumber(p.a) || 0;
    const d = Math.max(1, toNumber(p.d) || 0);
    // Simplified rating formula: (K + 0.7*A) / D
    return (k + 0.7 * a) / d;
  };

  const renderStatsTables = (playerStats) => {
    const teamAId = match?.teams?.a;
    const teamBId = match?.teams?.b;
    const teamAName = resolveTeam(teams, teamAId).name;
    const teamBName = resolveTeam(teams, teamBId).name;

    const playersA = playerStats.filter((p) => 
      String(p.team).toLowerCase() === String(teamAId).toLowerCase()
    );
    const playersB = playerStats.filter((p) => 
      String(p.team).toLowerCase() === String(teamBId).toLowerCase()
    );

    const renderTable = (teamName, teamPlayers) => {
      if (teamPlayers.length === 0) return `<p>${teamName}：暂无数据</p>`;
      
      // Sort players by rating descending
      const sortedPlayers = [...teamPlayers].sort((a, b) => calculateRating(b) - calculateRating(a));

      const rows = sortedPlayers
        .map((player) => {
          const k = toNumber(player?.k) || 0;
          const d = toNumber(player?.d) || 0;
          const diff = k - d;
          let diffClass = "";
          let diffText = diff > 0 ? `+${diff}` : `${diff}`;
          if (diff > 0) diffClass = "diff-pos";
          else if (diff < 0) diffClass = "diff-neg";

          const rating = calculateRating(player);
          let ratingClass = "";
          if (rating > 1.00) ratingClass = "diff-pos";
          else if (rating < 0.90) ratingClass = "diff-neg";

          return `
            <tr>
              <td>${safeText(player?.player)}</td>
              <td>${safeText(player?.k)}</td>
              <td>${safeText(player?.d)}</td>
              <td class="${diffClass}">${diffText}</td>
              <td>${safeText(player?.a)}</td>
              <td>${safeText(player?.damage)}</td>
              <td class="${ratingClass} font-mono">${rating.toFixed(2)}</td>
            </tr>
          `;
        }).join("");
      
      return `
        <div class="team-stats-block">
          <div class="team-stats-name">${teamName}</div>
          <div class="table-wrap">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>选手</th>
                  <th>K</th>
                  <th>D</th>
                  <th>+/-</th>
                  <th>A</th>
                  <th>伤害</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    statsArea.innerHTML = `
      <div class="stats-tables-grid stacked">
        ${renderTable(teamAName, playersA)}
        ${renderTable(teamBName, playersB)}
      </div>
    `;
  };

  // Initial render
  if (maps.length > 1) {
    renderStatsTables(allStats);
  } else if (maps.length === 1) {
    renderStatsTables(maps[0].player_stats || []);
  } else {
    statsArea.innerHTML = "<p>暂无选手数据</p>";
  }

  // Tab switching logic
  container.querySelectorAll(".map-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".map-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const idx = btn.dataset.mapIndex;
      if (idx === "all") {
        renderStatsTables(allStats);
      } else {
        renderStatsTables(maps[idx].player_stats || []);
      }
    });
  });
};

const loadMatch = async () => {
  const container = document.querySelector("#match-detail");
  if (!container) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get("id");
  if (!matchId) {
    container.innerHTML = "<h2>未指定比赛</h2><p>请从比赛列表点击进入。</p>";
    return;
  }

  try {
    const [teamsRes, matchesRes] = await Promise.all([
      fetch("data/teams.json"),
      fetch("data/matches.json"),
    ]);
    const teamsData = await teamsRes.json();
    const matchesData = await matchesRes.json();
    const match =
      Array.isArray(matchesData?.matches) &&
      matchesData.matches.find((item) => item?.id === matchId);
    render(container, match, teamsData?.teams);
  } catch (error) {
    console.error("加载失败", error);
    container.innerHTML = "<h2>加载失败</h2><p>请检查数据文件是否存在。</p>";
  }
};

loadMatch();
