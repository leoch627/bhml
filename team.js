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
    members: Array.isArray(team.members) ? team.members : [],
  };
};

const renderMatchCard = (match, teams) => {
  const resolveLocalTeam = (id) => {
    const team = teams[id];
    if (!team) return { name: safeText(id, "未知战队"), logo: "" };
    return { name: safeText(team.name, "未知战队"), logo: safeText(team.logo, "") };
  };

  const teamA = resolveLocalTeam(match?.teams?.a);
  const teamB = resolveLocalTeam(match?.teams?.b);

  const format = safeText(match?.format, "BO?");
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

  const status = safeText(match?.status, "tba").toLowerCase();
  const stage = safeText(match?.stage, "阶段未定");
  const time = toDateLabel(match?.time);
  const mapList = Array.isArray(match?.maps) && match.maps.length > 0 ? match.maps : null;

  const statusLabel =
    status === "completed"
      ? "已完成"
      : status === "live"
      ? "进行中"
      : "未开始";

  const mapText = mapList
    ? mapList.map((map) => safeText(map?.name)).join(" · ")
    : "TBA";

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

  const wrapper = document.createElement("a");
  wrapper.className = "match-card match-card-link";
  wrapper.href = match?.id ? `match.html?id=${match.id}` : "match.html";
  wrapper.innerHTML = `
    <div class="match-meta">
      <span>${stage}</span>
      <span>${format} · ${statusLabel}</span>
    </div>
    <div class="match-teams-row">
      <div class="match-teams">
        <div class="team">
          <img src="${teamA.logo}" alt="" onerror="this.style.display='none'" />
          <span class="team-name">${teamA.name}</span>
        </div>
        <div class="score-wrap">
          <span class="score ${scoreClassA}">${scoreA}</span>
          <span class="score-sep">:</span>
          <span class="score ${scoreClassB}">${scoreB}</span>
        </div>
        <div class="team team-right">
          <img src="${teamB.logo}" alt="" onerror="this.style.display='none'" />
          <span class="team-name">${teamB.name}</span>
        </div>
      </div>
    </div>
    <div class="match-extra">
      时间：${time} ｜ 地图：${mapText} ｜ 点击查看详情
    </div>
  `;
  return wrapper;
};

const render = (container, teamId, teams, matches) => {
  const team = resolveTeam(teams, teamId);
  if (!teams[teamId]) {
    container.innerHTML = "<h2>战队不存在</h2><p>请检查链接是否正确。</p>";
    return;
  }

  const teamMatches = matches.filter(m => m.teams.a === teamId || m.teams.b === teamId);
  const upcoming = teamMatches
    .filter(m => m.status !== "completed")
    .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0))
    .slice(0, 3);
  
  const completed = teamMatches
    .filter(m => m.status === "completed")
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 3);

  container.innerHTML = `
    <div class="team-header-hero">
      <img src="${team.logo}" alt="" onerror="this.style.display='none'" />
      <div class="team-header-info">
        <h1>${team.name}</h1>
        <p>战队主页</p>
      </div>
    </div>

    <div class="team-layout-grid">
      <div class="team-main-content">
        <div class="detail-section">
          <h3>队员名单</h3>
          <div class="table-wrap">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>姓名 / ID</th>
                </tr>
              </thead>
              <tbody>
                ${team.members.length === 0 
                  ? "<tr><td>暂无队员信息</td></tr>" 
                  : team.members.map(m => `<tr><td>${safeText(m)}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="team-side-content">
        <div class="detail-section">
          <h3>即将开始</h3>
          <div id="upcoming-list" class="match-list">
            ${upcoming.length === 0 ? "<p class='hint'>暂无赛程</p>" : ""}
          </div>
        </div>
        <div class="detail-section">
          <h3>最近结果</h3>
          <div id="completed-list" class="match-list">
            ${completed.length === 0 ? "<p class='hint'>暂无比赛结果</p>" : ""}
          </div>
        </div>
      </div>
    </div>
  `;

  const upcomingContainer = container.querySelector("#upcoming-list");
  const completedContainer = container.querySelector("#completed-list");

  upcoming.forEach(m => upcomingContainer.appendChild(renderMatchCard(m, teams)));
  completed.forEach(m => completedContainer.appendChild(renderMatchCard(m, teams)));
};

const loadTeam = async () => {
  const container = document.querySelector("#team-detail");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = params.get("id");
  if (!teamId) {
    container.innerHTML = "<h2>未指定战队</h2>";
    return;
  }

  try {
    const [teamsRes, matchesRes] = await Promise.all([
      fetch("data/teams.json"),
      fetch("data/matches.json"),
    ]);
    const teamsData = await teamsRes.json();
    const matchesData = await matchesRes.json();
    render(container, teamId, teamsData?.teams, matchesData?.matches || []);
  } catch (error) {
    console.error("加载失败", error);
    container.innerHTML = "<h2>加载失败</h2>";
  }
};

loadTeam();
