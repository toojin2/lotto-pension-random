/* 연금복권720+ : 조(1~5) + 6자리(0~9 독립) */
(() => {
"use strict";
const { $, esc, randInt, toast, copy, fmtDate } = U;
const DRAWS = (window.DRAWS || []).slice().sort((a,b) => a[0]-b[0]); // [회차, 조, 1등, 추첨일, 보너스]
const N = DRAWS.length, LATEST = DRAWS[N-1];
const KEY = "pension720.saved.v1";
let saved = U.loadList(KEY);
const gColor = g => `var(--g${g})`;
const fmtTicket = t => `${t.g}조 ${t.n}`;

/* 등수: 1등 조+6자리, 2등 6자리(조 다름), 3~7등 끝 5~1자리, 보너스 6자리(조 무관) */
function rank(t, draw){
  const [, g, n, , bonus] = draw;
  if (t.n === n) return t.g === g ? "1등" : "2등";
  if (bonus && t.n === bonus) return "보너스";
  for (let k = 5; k >= 1; k--) if (t.n.slice(6-k) === n.slice(6-k)) return (8 - k) + "등";
  return "";
}

/* 최신 당첨번호 */
function renderLatest(){
  const box = $("#p-latest");
  if (!LATEST){ box.innerHTML = `<p class="sub">당첨번호 데이터를 불러오지 못했습니다.</p>`; return; }
  const [r, g, n, date, bonus] = LATEST;
  const balls = s => s.split("").map(d => `<span class="ball mono">${d}</span>`).join("");
  box.innerHTML = `
    <div class="latest-top">
      <div><div class="eyebrow">연금복권720+ 최신 당첨번호</div><h2><span class="mono">${r}</span>회<span class="date">${fmtDate(date)}</span></h2></div>
      ${date ? `<div class="next">다음 ${r+1}회 추첨<b>${U.nextDraw(date, 19, 5)}</b></div>` : ""}
    </div>
    <div class="prize-row"><div class="lbl">1등<small>월 700만원 × 20년</small></div>
      <div class="numline" aria-label="1등 ${g}조 ${n}"><span class="gchip lg" style="background:${gColor(g)}">${g}조</span>${balls(n)}</div></div>
    ${bonus ? `<div class="prize-row"><div class="lbl">보너스<small>월 100만원 × 10년</small></div>
      <div class="numline" aria-label="보너스 각 조 ${bonus}"><span class="gchip lg any">각조</span>${balls(bonus)}</div></div>` : ""}`;
}

/* 번호 뽑기 */
const countSeg = $("#p-countSeg"), groupSeg = $("#p-groupSeg");
U.bindSeg(countSeg); U.bindSeg(groupSeg);
const fixRow = $("#p-fixRow");
for (let i = 0; i < 6; i++){
  const cell = document.createElement("label"); cell.className = "fixcell";
  cell.innerHTML = `<input id="p-fix${i}" inputmode="numeric" maxlength="1" autocomplete="off" placeholder="?" aria-label="${i+1}번째 자리 숫자"><span>${i+1}번째</span>`;
  fixRow.appendChild(cell);
  const inp = cell.querySelector("input");
  inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g,"").slice(0,1); if (inp.value && i < 5) $("#p-fix"+(i+1)).focus(); updateFixState(); });
  inp.addEventListener("keydown", e => { if (e.key === "Backspace" && !inp.value && i > 0) $("#p-fix"+(i-1)).focus(); });
}
const fixedPattern = () => [...Array(6).keys()].map(i => $("#p-fix"+i).value);
function updateFixState(){
  const p = fixedPattern(), any = p.some(v => v !== "");
  const st = $("#p-fixState"); st.textContent = any ? p.map(v => v || "?").join("") : "선택 사항"; st.classList.toggle("mono", any);
}
$("#p-fixClear").onclick = () => { for (let i = 0; i < 6; i++) $("#p-fix"+i).value = ""; updateFixState(); };

function makeTicket(){
  const g = U.segValue(groupSeg) || randInt(5) + 1, p = fixedPattern();
  return { g, n: p.map(v => v !== "" ? v : String(randInt(10))).join(""), fixed: p.map(v => v !== "") };
}
const markSaved = b => { b.textContent = "저장됨"; b.disabled = true; };

function ticketEl(t, idx, { animate = false, mode = "new" } = {}){
  const row = document.createElement("div"); row.className = "ticket";
  const reels = t.n.split("").map((d,i) => `<span class="reel${t.fixed && t.fixed[i] ? " fixed" : ""}" data-i="${i}">${animate && !(t.fixed && t.fixed[i]) ? "0" : d}</span>`).join("");
  let meta = "";
  if (mode === "saved" && LATEST){
    const r = rank(t, LATEST);
    meta = `<span class="result-badge ${r ? "win" : "lose"}">${LATEST[0]}회 ${r ? r + " 당첨" : "미당첨"}</span>`;
  }
  row.innerHTML = `<span class="idx mono">${idx+1}</span>
    <div class="numline" aria-label="${esc(fmtTicket(t))}"><span class="gchip" style="background:${gColor(t.g)}">${t.g}조</span>${reels}</div>
    ${meta}
    <div class="act"><button class="btn ghost" data-act="copy">복사</button>
      ${mode === "saved" ? `<button class="btn ghost" data-act="del">삭제</button>` : `<button class="btn ghost" data-act="save">저장</button>`}</div>`;
  row.querySelector('[data-act="copy"]').onclick = () => copy(fmtTicket(t));
  const sb = row.querySelector('[data-act="save"]'); if (sb) sb.onclick = () => { addSaved([t]); markSaved(sb); };
  const db = row.querySelector('[data-act="del"]'); if (db) db.onclick = () => { saved = saved.filter(s => s.id !== t.id); U.storeList(KEY, saved); renderSaved(); updateCount(); };
  return row;
}

function spin(rowEls, tickets){
  return new Promise(resolve => {
    const reels = rowEls.map(r => [...r.querySelectorAll(".reel")]);
    const finish = () => { reels.forEach((rs,k) => rs.forEach((el,i) => { if (el.classList.contains("spinning")){ el.textContent = tickets[k].n[i]; el.classList.remove("spinning"); } })); resolve(); };
    if (U.reduceMotion){ reels.forEach((rs,k) => rs.forEach((el,i) => el.textContent = tickets[k].n[i])); return resolve(); }
    reels.forEach((rs,k) => rs.forEach((el,i) => { if (!(tickets[k].fixed && tickets[k].fixed[i])) el.classList.add("spinning"); }));
    const start = performance.now(), base = 400, step = 130, rowLag = 50; let last = 0;
    function frame(now){
      const t = now - start; let pending = false;
      if (now - last > 50){ last = now;
        reels.forEach((rs,k) => rs.forEach((el,i) => {
          if (!el.classList.contains("spinning")) return;
          if (t >= base + i*step + k*rowLag){ el.textContent = tickets[k].n[i]; el.classList.remove("spinning"); el.classList.add("landed"); }
          else el.textContent = Math.floor(Math.random()*10); // 연출용
        }));
      }
      reels.forEach(rs => rs.forEach(el => { if (el.classList.contains("spinning")) pending = true; }));
      pending ? requestAnimationFrame(frame) : resolve();
    }
    requestAnimationFrame(frame);
    setTimeout(finish, 3000);
  });
}

let current = [];
$("#p-genBtn").addEventListener("click", async () => {
  const btn = $("#p-genBtn"); btn.disabled = true; btn.textContent = "뽑는 중…";
  current = Array.from({ length: U.segValue(countSeg) }, makeTicket);
  $("#p-resultCard").hidden = false;
  const box = $("#p-tickets"); box.innerHTML = "";
  const rows = current.map((t,i) => { const r = ticketEl(t, i, { animate: true }); box.appendChild(r); return r; });
  if ($("#p-resultCard").getBoundingClientRect().top > innerHeight - 120) $("#p-resultCard").scrollIntoView({ behavior: U.reduceMotion ? "auto" : "smooth", block: "start" });
  await spin(rows, current);
  btn.disabled = false; btn.textContent = "다시 뽑기";
  const sa = $("#p-saveAllBtn"); sa.disabled = false; sa.textContent = "전체 저장";
});
$("#p-copyAllBtn").onclick = () => copy(current.map(fmtTicket).join("\n"));
$("#p-saveAllBtn").onclick = () => {
  const btns = [...document.querySelectorAll('#p-tickets [data-act="save"]')];
  const left = current.filter((t,i) => !btns[i].disabled);
  if (left.length) addSaved(left);
  btns.forEach(markSaved); markSaved($("#p-saveAllBtn"));
};

function addSaved(list){
  const now = Date.now();
  list.slice().reverse().forEach((t,i) => saved.unshift({ id: `${now}-${i}-${randInt(250)}`, g: t.g, n: t.n, at: now }));
  saved = saved.slice(0, 200); U.storeList(KEY, saved); updateCount(); toast(`${list.length}장 저장했습니다`);
}
function updateCount(){ const c = $("#p-savedCount"); c.textContent = saved.length; c.hidden = !saved.length; }
function renderSaved(){
  const box = $("#p-savedList"), sum = $("#p-savedSummary"); box.innerHTML = "";
  $("#p-clearSaved").hidden = !saved.length;
  if (!saved.length){
    sum.innerHTML = ""; $("#p-savedSub").textContent = "";
    box.innerHTML = `<div class="empty"><p>아직 저장한 번호가 없습니다.</p><button class="btn" data-go="gen">번호 뽑으러 가기</button></div>`;
    box.querySelector("[data-go]").onclick = () => tabs.select("gen", true);
    return;
  }
  $("#p-savedSub").textContent = `${LATEST[0]}회 당첨번호와 자동으로 맞춰 봅니다. 이 브라우저에만 저장됩니다.`;
  const wins = saved.map(t => rank(t, LATEST)).filter(Boolean);
  const order = r => r === "보너스" ? 1.5 : parseInt(r);
  const best = wins.length ? wins.sort((a,b) => order(a) - order(b))[0] : "-";
  sum.innerHTML = `<div class="pill">저장한 번호<b class="mono">${saved.length}장</b></div>
    <div class="pill">${LATEST[0]}회 당첨<b class="mono">${wins.length}장</b></div>
    <div class="pill">가장 높은 등수<b>${best}</b></div>`;
  saved.forEach((t,i) => box.appendChild(ticketEl(t, i, { mode: "saved" })));
}
$("#p-clearSaved").onclick = () => { if (saved.length && confirm("저장한 연금복권 번호를 모두 삭제할까요?")){ saved = []; U.storeList(KEY, saved); renderSaved(); updateCount(); } };

/* 통계 */
let statsDrawn = false;
function drawStats(){
  $("#p-statsRange").textContent = `1회~${LATEST[0]}회, 총 ${N}번의 추첨을 완전 무작위일 때와 비교했습니다.`;
  const digits = DRAWS.map(d => d[2].split("").map(Number));

  const posCounts = [0,1,2,3,4,5].map(p => { const c = Array(10).fill(0); digits.forEach(ds => c[ds[p]]++); return c; });
  const posSeg = $("#p-posSeg");
  posSeg.innerHTML = [1,2,3,4,5,6].map(p => `<button aria-pressed="${p===1}" data-v="${p}" aria-label="${p}번째 자리">${p}</button>`).join("");
  const drawPos = p => {
    const labels = [...Array(10).keys()].map(String), exp = Array(10).fill(N/10);
    U.barChart($("#p-chartDigit"), { labels, values: posCounts[p-1], expected: exp, xTitle: `${p}번째 자리 숫자` });
    U.table($("#p-tblDigit"), `${p}번째 자리`, labels, posCounts[p-1], exp);
  };
  U.bindSeg(posSeg, drawPos); drawPos(1);

  let dist = [1]; for (let k = 0; k < 6; k++){ const nd = Array(dist.length+9).fill(0); dist.forEach((v,i) => { for (let j = 0; j < 10; j++) nd[i+j] += v; }); dist = nd; }
  const sums = digits.map(ds => ds.reduce((a,b) => a+b, 0));
  const bins = [[0,15],[16,19],[20,23],[24,27],[28,31],[32,35],[36,39],[40,54]];
  const sumLabels = bins.map(([a,b]) => a === 0 ? `~${b}` : b === 54 ? `${a}~` : `${a}-${b}`);
  const sumObs = bins.map(([a,b]) => sums.filter(s => s >= a && s <= b).length);
  const sumExp = bins.map(([a,b]) => { let t = 0; for (let s = a; s <= b; s++) t += dist[s]; return t/1e6*N; });
  U.barChart($("#p-chartSum"), { labels: sumLabels, values: sumObs, expected: sumExp, xTitle: "합계" });
  U.table($("#p-tblSum"), "합계", sumLabels, sumObs, sumExp);

  const oddObs = Array(7).fill(0); digits.forEach(ds => oddObs[ds.filter(d => d%2).length]++);
  const oddExp = [...Array(7).keys()].map(k => U.comb(6,k)/64*N), oddLabels = [...Array(7).keys()].map(k => `${k}개`);
  U.barChart($("#p-chartOdd"), { labels: oddLabels, values: oddObs, expected: oddExp, xTitle: "홀수 개수" });
  U.table($("#p-tblOdd"), "홀수 개수", oddLabels, oddObs, oddExp);

  const gObs = Array(5).fill(0); DRAWS.forEach(d => gObs[d[1]-1]++);
  const gExp = Array(5).fill(N/5), gLabels = [1,2,3,4,5].map(g => `${g}조`);
  U.barChart($("#p-chartGroup"), { labels: gLabels, values: gObs, expected: gExp, xTitle: "조" });
  U.table($("#p-tblGroup"), "조", gLabels, gObs, gExp);

  const ps = [...posCounts.map(c => U.chiTest(c, Array(10).fill(N/10))), U.chiTest(sumObs,sumExp), U.chiTest(oddObs,oddExp), U.chiTest(gObs,gExp)];
  $("#p-verdict").innerHTML = U.verdictHTML(ps);
  const mean = sums.reduce((a,b) => a+b, 0)/N, oddRatio = oddObs.reduce((s,v,k) => s+v*k, 0)/(6*N);
  $("#p-facts").innerHTML = U.factsHTML([
    ["숫자 합계 평균", mean.toFixed(1), "무작위라면 27.0"],
    ["홀수 비율", (oddRatio*100).toFixed(0)+"%", "무작위라면 50%"],
    ["같은 번호가 또 1등", (N - new Set(DRAWS.map(d => d[2])).size)+"번", "무작위라면 거의 0번"],
  ]);
}

/* 탭 */
const tabs = U.makeTabs($("#p-tabs"), name => {
  if (name === "draws" && !statsDrawn){ drawStats(); statsDrawn = true; }
  if (name === "saved") renderSaved();
}, "pension.tab");

renderLatest();
if (N) U.drawList({ table: $("#p-drawTable"), more: $("#p-moreBtn"), form: $("#p-searchForm"), input: $("#p-searchInput"), data: DRAWS,
  head: `<th>회차</th><th>1등</th><th>보너스</th>`,
  row: d => `<tr><td class="rnd"><span class="mono">${d[0]}</span>회<small>${fmtDate(d[3])}</small></td>
    <td><div class="cell1"><span class="gchip sm" style="background:${gColor(d[1])}">${d[1]}조</span><span class="digits">${d[2]}</span></div></td>
    <td class="digits bonus">${d[4] || "-"}</td></tr>` });
updateCount();

window.GAMES = window.GAMES || {};
window.GAMES.pension = { tabs, updated: (window.DRAWS_META || {}).updatedAt, defaultTab: () => U.sget("pension.tab") || "gen" };
})();
