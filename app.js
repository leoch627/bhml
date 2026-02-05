const MAP_POOL = [
  "Dust 2",
  "Mirage",
  "Anubis",
  "Ancient",
  "Nuke",
  "Inferno",
  "Overpass",
];

const state = {
  teams: {},
  matches: [],
};

const tabButtons = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

const setActiveTab = (target) => {
  if (!target || !document.querySelector(`#${target}`)) {
    target = "intro";
  }
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === target;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === target);
  });
};

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    window.location.hash = target;
    localStorage.setItem("bhml-last-tab", target);
  });
});

const initTabs = () => {
  const handleHash = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setActiveTab(hash);
      localStorage.setItem("bhml-last-tab", hash);
    } else {
      const lastTab = localStorage.getItem("bhml-last-tab") || "intro";
      setActiveTab(lastTab);
    }
  };

  window.addEventListener("hashchange", handleHash);
  handleHash();
};

const upcomingList = document.querySelector("#upcoming-list");
const completedList = document.querySelector("#completed-list");
const standingsBody = document.querySelector("#standings-body");

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

const resolveTeam = (id) => {
  const team = state.teams[id];
  if (!team) {
    return {
      name: safeText(id, "未知战队"),
      logo: "",
    };
  }
  return {
    name: safeText(team.name, "未知战队"),
    logo: safeText(team.logo, ""),
  };
};

const renderMatchCard = (match) => {
  const teamA = resolveTeam(match?.teams?.a);
  const teamB = resolveTeam(match?.teams?.b);

  const format = safeText(match?.format, "BO?");
  const maps = Array.isArray(match?.maps) ? match.maps : [];

  let scoreAValue = toNumber(match?.score?.a);
  let scoreBValue = toNumber(match?.score?.b);

  // If BO1, use the score of the first map if available
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

const loadData = async () => {
  try {
    const [teamsRes, matchesRes] = await Promise.all([
      fetch("data/teams.json"),
      fetch("data/matches.json"),
    ]);

    const teamsData = await teamsRes.json();
    const matchesData = await matchesRes.json();

    state.teams = teamsData?.teams || {};
    state.matches = Array.isArray(matchesData?.matches) ? matchesData.matches : [];
  } catch (error) {
    console.error("数据加载失败", error);
    upcomingList.innerHTML =
      "<div class='match-card'>数据加载失败，请检查 data/teams.json 和 data/matches.json。</div>";
    completedList.innerHTML = "";
    return;
  }

  renderMatches();
  renderStandings();
};

const renderMatches = () => {
  upcomingList.innerHTML = "";
  completedList.innerHTML = "";

  const sorted = [...state.matches].sort((a, b) => {
    const timeA = new Date(a?.time || 0).getTime() || 0;
    const timeB = new Date(b?.time || 0).getTime() || 0;
    return timeA - timeB;
  });

  const completed = sorted.filter((match) => match?.status === "completed");
  const upcoming = sorted.filter((match) => match?.status !== "completed");

  if (upcoming.length === 0) {
    upcomingList.innerHTML = "<div class='match-card'>暂无赛程</div>";
  } else {
    upcoming.forEach((match) => upcomingList.appendChild(renderMatchCard(match)));
  }

  if (completed.length === 0) {
    completedList.innerHTML = "<div class='match-card'>暂无已完成比赛</div>";
  } else {
    completed.forEach((match) => completedList.appendChild(renderMatchCard(match)));
  }
};

const buildTeamStats = () => {
  const stats = {};
  Object.keys(state.teams).forEach((id) => {
    if (id === "tba") {
      return;
    }
    stats[id] = {
      id,
      wins: 0,
      losses: 0,
      lastMatch: null,
    };
  });

  const completedMatches = state.matches.filter((match) => match?.status === "completed");
  completedMatches.forEach((match) => {
    const teamA = match?.teams?.a;
    const teamB = match?.teams?.b;
    if (!teamA || !teamB) {
      return;
    }
    if (teamA !== "tba" && !stats[teamA]) {
      stats[teamA] = { id: teamA, wins: 0, losses: 0, lastMatch: null };
    }
    if (teamB !== "tba" && !stats[teamB]) {
      stats[teamB] = { id: teamB, wins: 0, losses: 0, lastMatch: null };
    }
    const scoreA = toNumber(match?.score?.a);
    const scoreB = toNumber(match?.score?.b);
    if (scoreA === null || scoreB === null) {
      return;
    }
    if (scoreA > scoreB) {
      stats[teamA].wins += 1;
      stats[teamB].losses += 1;
    } else if (scoreA < scoreB) {
      stats[teamB].wins += 1;
      stats[teamA].losses += 1;
    }
  });

  Object.values(stats).forEach((teamStat) => {
    const matches = completedMatches
      .filter((match) => match?.teams?.a === teamStat.id || match?.teams?.b === teamStat.id)
      .sort((a, b) => new Date(a?.time || 0) - new Date(b?.time || 0));
    teamStat.lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;
  });

  return stats;
};

const getStreak = (teamId) => {
  const completedMatches = state.matches
    .filter((match) => match?.status === "completed")
    .sort((a, b) => new Date(b?.time || 0) - new Date(a?.time || 0));
  let streak = 0;
  let streakType = null;
  for (const match of completedMatches) {
    const involved = match?.teams?.a === teamId || match?.teams?.b === teamId;
    if (!involved) {
      continue;
    }
    const scoreA = toNumber(match?.score?.a);
    const scoreB = toNumber(match?.score?.b);
    if (scoreA === null || scoreB === null) {
      continue;
    }
    const isTeamA = match?.teams?.a === teamId;
    const teamWin = isTeamA ? scoreA > scoreB : scoreB > scoreA;
    const currentType = teamWin ? "W" : "L";
    if (!streakType) {
      streakType = currentType;
      streak = 1;
    } else if (streakType === currentType) {
      streak += 1;
    } else {
      break;
    }
  }
  if (!streakType) {
    return "—";
  }
  return `${streakType}${streak}`;
};

const renderStandings = () => {
  if (!standingsBody) {
    return;
  }
  standingsBody.innerHTML = "";
  const stats = buildTeamStats();
  const rows = Object.values(stats).map((teamStat) => {
    const team = resolveTeam(teamStat.id);
    const total = teamStat.wins + teamStat.losses;
    const winRate = total === 0 ? "0%" : `${Math.round((teamStat.wins / total) * 100)}%`;
    const streak = getStreak(teamStat.id);
    let lastMatchText = "TBA";
    if (teamStat.lastMatch) {
      const isTeamA = teamStat.lastMatch?.teams?.a === teamStat.id;
      const opponentId = isTeamA
        ? teamStat.lastMatch?.teams?.b
        : teamStat.lastMatch?.teams?.a;
      const opponent = resolveTeam(opponentId);
      const scoreA = safeText(teamStat.lastMatch?.score?.a, "TBA");
      const scoreB = safeText(teamStat.lastMatch?.score?.b, "TBA");
      const teamScore = isTeamA ? scoreA : scoreB;
      const opponentScore = isTeamA ? scoreB : scoreA;
      lastMatchText = `vs ${opponent.name} ${teamScore}:${opponentScore}`;
    }
    return { id: teamStat.id, team, winRate, streak, lastMatchText, wins: teamStat.wins, losses: teamStat.losses };
  });

  rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  rows.forEach((row) => {
    const item = document.createElement("a");
    item.className = "standings-row standings-row-link";
    item.href = `team.html?id=${row.id}`;
    item.innerHTML = `
      <div class="standings-team">
        <img src="${row.team.logo}" alt="" onerror="this.style.display='none'" />
        <span>${row.team.name}</span>
      </div>
      <div>${row.winRate}</div>
      <div>${row.streak}</div>
      <div class="standings-muted">${row.lastMatchText}</div>
    `;
    standingsBody.appendChild(item);
  });
};

initTabs();
loadData();
