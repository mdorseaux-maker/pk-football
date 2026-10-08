import fs from "node:fs";

const key = process.env.API_FOOTBALL_KEY;
if (!key) throw new Error("API_FOOTBALL_KEY is missing");

const BASE = "https://v3.football.api-sports.io";
const LEAGUES = new Set([2,39,61,78,135,140]);
const headers = {"x-apisports-key": key, "Accept": "application/json"};

async function api(path) {
  const r = await fetch(BASE + path, {headers});
  if (!r.ok) throw new Error("API HTTP " + r.status);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) throw new Error(JSON.stringify(j.errors));
  return j.response || [];
}

const iso = d => d.toISOString().slice(0,10);
const dates = ["2026-10-08", "2026-10-09"];

let fixtures = [];
for (const date of dates) {
  const rows = await api("/fixtures?date=" + date);
  fixtures.push(...rows.filter(x => LEAGUES.has(Number(x.league?.id))));
}

fixtures.sort((a,b) => new Date(a.fixture.date) - new Date(b.fixture.date));

const out = fixtures.map(x => ({
  id:x.fixture.id,
  date:x.fixture.date,
  status:x.fixture.status?.short,
  league:{id:x.league?.id,name:x.league?.name,country:x.league?.country},
  home:{id:x.teams?.home?.id,name:x.teams?.home?.name},
  away:{id:x.teams?.away?.id,name:x.teams?.away?.name},
  goals:{home:x.goals?.home,away:x.goals?.away}
}));

for (const m of out.slice(0,10)) {
  try {
    const p = (await api("/predictions?fixture=" + m.id))[0];
    if (p) m.prediction = {
      winner:p.predictions?.winner?.name ?? null,
      advice:p.predictions?.advice ?? null,
      percent:p.predictions?.percent ?? null,
      goals:p.predictions?.goals ?? null,
      score:p.predictions?.score ?? null
    };
  } catch {}
}

const live = (await api("/fixtures?live=all"))
  .filter(x => LEAGUES.has(Number(x.league?.id)))
  .map(x => ({
    id:x.fixture.id,
    date:x.fixture.date,
    status:x.fixture.status?.short,
    elapsed:x.fixture.status?.elapsed ?? null,
    league:{id:x.league?.id,name:x.league?.name},
    home:{id:x.teams?.home?.id,name:x.teams?.home?.name},
    away:{id:x.teams?.away?.id,name:x.teams?.away?.name},
    goals:{home:x.goals?.home,away:x.goals?.away}
  }));

fs.writeFileSync("data.json", JSON.stringify({
  updatedAt:new Date().toISOString(),
  fixtures:out,
  live
}, null, 2));

console.log("Updated", out.length, "fixtures and", live.length, "live matches");
