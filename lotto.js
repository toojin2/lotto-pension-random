/* 로또 6/45 : 1~45 중 서로 다른 6개 + 보너스 */
(() => {
"use strict";
const { $, esc, randInt, toast, copy, fmtDate, fmtWon } = U;
const DRAWS = (window.LOTTO || []).slice().sort((a,b) => a[0]-b[0]); // [회차, [번호6], 보너스, 추첨일, 1등 수, 1등 1인당]
const N = DRAWS.length, LATEST = DRAWS[N-1];
const KEY = "lotto645.saved.v1";
let saved = U.loadList(KEY);
const rc = n => n <= 10 ? "r1" : n <= 20 ? "r2" : n <= 30 ? "r3" : n <= 40 ? "r4" : "r5";
const ball = (n, size = "", extra = "") => `<span class="lball ${size} ${rc(n)} ${extra}">${n}</span>`;
const fmtGame = nums => nums.join(", ");
const LETTERS = "ABCDEFGHIJ";

/* 등수: 1등 6개, 2등 5개+보너스, 3등 5개, 4등 4개, 5등 3개 */
function rank(nums, draw){
  const win = new Set(draw[1]), m = nums.filter(n => win.has(n)).length;
  if (m === 6) return "1등";
  if (m === 5) return nums.includes(draw[2]) ? "2등" : "3등";
  if (m === 4) return "4등";
  if (m === 3) return "5등";
  return "";
}

/* 최신 당첨번호 */
function renderLatest(){
  const box = $("#l-latest");
  if (!LATEST){ box.innerHTML = `<p class="sub">당첨번호 데이터를 불러오지 못했습니다.</p>`; return; }
  const [r, nums, bonus, date, w1, amt1] = LATEST;
  box.innerHTML = `
    <div class="latest-top">
      <div><div class="eyebrow">로또 6/45 최신 당첨번호</div><h2><span class="mono">${r}</span>회<span class="date">${fmtDate(date)}</span></h2></div>
      ${date ? `<div class="next">다음 ${r+1}회 추첨<b>${U.nextDraw(date, 20, 35)}</b></div>` : ""}
    </div>
    <div class="ballrow" aria-label="당첨번호 ${nums.join(" ")} 보너스 ${bonus}">${nums.map(n => ball(n)).join("")}<span class="plus">+</span>${ball(bonus)}</div>
    <p class="prize-info">1등 <b>${w1.toLocaleString()}명</b>${w1 ? ` · 1인당 <b>${fmtWon(amt1)}</b>` : " · 당첨자 없음(이월)"}</p>`;
}

/* 번호 선택판: 탭할 때마다 없음 → 꼭 넣기 → 빼기 → 없음 */
const pick = new Map(); // n -> "inc" | "exc"
const picker = $("#l-picker");
picker.innerHTML = Array.from({ length: 45 }, (_, i) => `<button type="button" data-n="${i+1}" aria-label="${i+1}번">${i+1}</button>`).join("");
picker.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const n = +b.dataset.n, cur = pick.get(n);
  const inc = [...pick.values()].filter(v => v === "inc").length;
  if (!cur){ if (inc >= 5){ pick.set(n, "exc"); toast("꼭 넣을 번호는 5개까지입니다"); } else pick.set(n, "inc"); }
  else if (cur === "inc") pick.set(n, "exc");
  else pick.delete(n);
  if (45 - [...pick.values()].filter(v => v === "exc").length < 6){ pick.delete(n); toast("남은 번호가 6개보다 적어집니다"); }
  renderPicker();
});
function renderPicker(){
  picker.querySelectorAll("button").forEach(b => { const s = pick.get(+b.dataset.n); b.className = s || ""; b.setAttribute("aria-pressed", s ? "true" : "false"); });
  const inc = [...pick].filter(([,v]) => v === "inc").map(([k]) => k).sort((a,b) => a-b);
  const exc = [...pick].filter(([,v]) => v === "exc").map(([k]) => k).sort((a,b) => a-b);
  $("#l-pickSummary").innerHTML = (inc.length || exc.length)
    ? `${inc.length ? `꼭 넣기 <b class="mono">${inc.join(", ")}</b>` : ""}${inc.length && exc.length ? " · " : ""}${exc.length ? `빼기 <b class="mono">${exc.join(", ")}</b>` : ""}`
    : "번호를 누르면 꼭 넣기, 한 번 더 누르면 빼기, 다시 누르면 해제됩니다.";
  $("#l-pickState").textContent = (inc.length || exc.length) ? `넣기 ${inc.length} · 빼기 ${exc.length}` : "선택 사항";
}
$("#l-pickClear").onclick = () => { pick.clear(); renderPicker(); };
renderPicker();

const countSeg = $("#l-countSeg"); U.bindSeg(countSeg);
function makeGame(){
  const inc = [...pick].filter(([,v]) => v === "inc").map(([k]) => k);
  const pool = []; for (let n = 1; n <= 45; n++) if (!pick.has(n)) pool.push(n);
  const out = inc.slice();
  for (let k = pool.length - 1; out.length < 6; k--){ const j = randInt(k + 1); [pool[k], pool[j]] = [pool[j], pool[k]]; out.push(pool[k]); }
  const nums = out.sort((a,b) => a-b);
  return { nums, fixed: nums.map(n => inc.includes(n)) };
}
const markSaved = b => { b.textContent = "저장됨"; b.disabled = true; };

function gameEl(t, idx, { animate = false, mode = "new" } = {}){
  const row = document.createElement("div"); row.className = "ticket";
  const balls = t.nums.map((n,i) => animate && !(t.fixed && t.fixed[i])
    ? `<span class="lball spinning" data-i="${i}">?</span>`
    : ball(n, "", t.fixed && t.fixed[i] ? "fixed" : "")).join("");
  let meta = "";
  if (mode === "saved" && LATEST){
    const r = rank(t.nums, LATEST);
    meta = `<span class="result-badge ${r ? "win" : "lose"}">${LATEST[0]}회 ${r ? r + " 당첨" : "미당첨"}</span>`;
  }
  row.innerHTML = `<span class="gl">${mode === "saved" ? idx+1 : LETTERS[idx]}</span>
    <div class="ballrow numline" aria-label="${esc(fmtGame(t.nums))}">${balls}</div>
    ${meta}
    <div class="act"><button class="btn ghost" data-act="copy">복사</button>
      ${mode === "saved" ? `<button class="btn ghost" data-act="del">삭제</button>` : `<button class="btn ghost" data-act="save">저장</button>`}</div>`;
  row.querySelector('[data-act="copy"]').onclick = () => copy(fmtGame(t.nums));
  const sb = row.querySelector('[data-act="save"]'); if (sb) sb.onclick = () => { addSaved([t]); markSaved(sb); };
  const db = row.querySelector('[data-act="del"]'); if (db) db.onclick = () => { saved = saved.filter(s => s.id !== t.id); U.storeList(KEY, saved); renderSaved(); updateCount(); };
  return row;
}

function spin(rowEls, games){
  return new Promise(resolve => {
    const slots = rowEls.map(r => [...r.querySelectorAll(".lball.spinning")]);
    const land = (el, k) => { const n = games[k].nums[+el.dataset.i]; el.className = `lball ${rc(n)} landed`; el.textContent = n; };
    const finish = () => { slots.forEach((ss,k) => ss.forEach(el => { if (el.classList.contains("spinning")) land(el, k); })); resolve(); };
    if (U.reduceMotion) return finish();
    const start = performance.now(), base = 350, step = 140, rowLag = 50; let last = 0;
    function frame(now){
      const t = now - start; let pending = false;
      if (now - last > 50){ last = now;
        slots.forEach((ss,k) => ss.forEach(el => {
          if (!el.classList.contains("spinning")) return;
          if (t >= base + (+el.dataset.i)*step + k*rowLag) land(el, k);
          else el.textContent = 1 + Math.floor(Math.random()*45); // 연출용
        }));
      }
      slots.forEach(ss => ss.forEach(el => { if (el.classList.contains("spinning")) pending = true; }));
      pending ? requestAnimationFrame(frame) : resolve();
    }
    requestAnimationFrame(frame);
    setTimeout(finish, 3000);
  });
}

let current = [];
$("#l-genBtn").addEventListener("click", async () => {
  const btn = $("#l-genBtn"); btn.disabled = true; btn.textContent = "뽑는 중…";
  current = Array.from({ length: U.segValue(countSeg) }, makeGame);
  $("#l-resultCard").hidden = false;
  const box = $("#l-tickets"); box.innerHTML = "";
  const rows = current.map((t,i) => { const r = gameEl(t, i, { animate: true }); box.appendChild(r); return r; });
  if ($("#l-resultCard").getBoundingClientRect().top > innerHeight - 120) $("#l-resultCard").scrollIntoView({ behavior: U.reduceMotion ? "auto" : "smooth", block: "start" });
  await spin(rows, current);
  btn.disabled = false; btn.textContent = "다시 뽑기";
  const sa = $("#l-saveAllBtn"); sa.disabled = false; sa.textContent = "전체 저장";
});
$("#l-copyAllBtn").onclick = () => copy(current.map((t,i) => `${LETTERS[i]} ${fmtGame(t.nums)}`).join("\n"));
$("#l-saveAllBtn").onclick = () => {
  const btns = [...document.querySelectorAll('#l-tickets [data-act="save"]')];
  const left = current.filter((t,i) => !btns[i].disabled);
  if (left.length) addSaved(left);
  btns.forEach(markSaved); markSaved($("#l-saveAllBtn"));
};

function addSaved(list){
  const now = Date.now();
  list.slice().reverse().forEach((t,i) => saved.unshift({ id: `${now}-${i}-${randInt(250)}`, nums: t.nums, at: now }));
  saved = saved.slice(0, 200); U.storeList(KEY, saved); updateCount(); toast(`${list.length}게임 저장했습니다`);
}
function updateCount(){ const c = $("#l-savedCount"); c.textContent = saved.length; c.hidden = !saved.length; }
function renderSaved(){
  const box = $("#l-savedList"), sum = $("#l-savedSummary"); box.innerHTML = "";
  $("#l-clearSaved").hidden = !saved.length;
  if (!saved.length){
    sum.innerHTML = ""; $("#l-savedSub").textContent = "";
    box.innerHTML = `<div class="empty"><p>아직 저장한 번호가 없습니다.</p><button class="btn" data-go="gen">번호 뽑으러 가기</button></div>`;
    box.querySelector("[data-go]").onclick = () => tabs.select("gen", true);
    return;
  }
  $("#l-savedSub").textContent = `${LATEST[0]}회 당첨번호와 자동으로 맞춰 봅니다. 이 브라우저에만 저장됩니다.`;
  const wins = saved.map(t => rank(t.nums, LATEST)).filter(Boolean).sort((a,b) => parseInt(a) - parseInt(b));
  sum.innerHTML = `<div class="pill">저장한 번호<b class="mono">${saved.length}게임</b></div>
    <div class="pill">${LATEST[0]}회 당첨<b class="mono">${wins.length}게임</b></div>
    <div class="pill">가장 높은 등수<b>${wins[0] || "-"}</b></div>`;
  saved.forEach((t,i) => box.appendChild(gameEl(t, i, { mode: "saved" })));
}
$("#l-clearSaved").onclick = () => { if (saved.length && confirm("저장한 로또 번호를 모두 삭제할까요?")){ saved = []; U.storeList(KEY, saved); renderSaved(); updateCount(); } };

/* 통계 */
let statsDrawn = false;
function drawStats(){
  $("#l-statsRange").textContent = `1회~${LATEST[0]}회, 총 ${N}번의 추첨을 완전 무작위일 때와 비교했습니다.`;
  const total = C(45, 6);

  // 번호별
  const freq = Array(45).fill(0); DRAWS.forEach(d => d[1].forEach(n => freq[n-1]++));
  const fExp = Array(45).fill(N*6/45), fLabels = Array.from({ length: 45 }, (_, i) => String(i+1));
  U.barChart($("#l-chartFreq"), { labels: fLabels, values: freq, expected: fExp, xTitle: "번호별 출현", labelEvery: 5 });
  U.table($("#l-tblFreq"), "번호", fLabels, freq, fExp);

  // 번호대
  const ranges = [[1,10],[11,20],[21,30],[31,40],[41,45]];
  const rLabels = ranges.map(([a,b]) => `${a}~${b}`);
  const rObs = ranges.map(([a,b]) => freq.slice(a-1, b).reduce((s,v) => s+v, 0));
  const rExp = ranges.map(([a,b]) => N*6*(b-a+1)/45);
  U.barChart($("#l-chartRange"), { labels: rLabels, values: rObs, expected: rExp, xTitle: "번호대" });
  U.table($("#l-tblRange"), "번호대", rLabels, rObs, rExp);

  // 합계: 1~45에서 6개를 고르는 모든 조합의 합 분포 (정확한 값)
  const dp = Array.from({ length: 7 }, () => new Float64Array(256)); dp[0][0] = 1;
  for (let n = 1; n <= 45; n++) for (let k = 6; k >= 1; k--) for (let s = 255; s >= n; s--) dp[k][s] += dp[k-1][s-n];
  const sums = DRAWS.map(d => d[1].reduce((a,b) => a+b, 0));
  const bins = [[21,90],[91,105],[106,120],[121,135],[136,150],[151,165],[166,180],[181,255]];
  const sLabels = bins.map(([a,b]) => a === 21 ? `~${b}` : b === 255 ? `${a}~` : `${a}-${b}`);
  const sObs = bins.map(([a,b]) => sums.filter(s => s >= a && s <= b).length);
  const sExp = bins.map(([a,b]) => { let t = 0; for (let s = a; s <= b; s++) t += dp[6][s]; return t/total*N; });
  U.barChart($("#l-chartSum"), { labels: sLabels, values: sObs, expected: sExp, xTitle: "합계" });
  U.table($("#l-tblSum"), "합계", sLabels, sObs, sExp);

  // 홀수 개수 (홀 23개, 짝 22개)
  const oObs = Array(7).fill(0); DRAWS.forEach(d => oObs[d[1].filter(n => n%2).length]++);
  const oExp = [...Array(7).keys()].map(k => C(23,k)*C(22,6-k)/total*N), oLabels = [...Array(7).keys()].map(k => `${k}개`);
  U.barChart($("#l-chartOdd"), { labels: oLabels, values: oObs, expected: oExp, xTitle: "홀수 개수" });
  U.table($("#l-tblOdd"), "홀수 개수", oLabels, oObs, oExp);

  const ps = [U.chiTest(freq, fExp), U.chiTest(rObs, rExp), U.chiTest(sObs, sExp), U.chiTest(oObs, oExp)];
  $("#l-verdict").innerHTML = U.verdictHTML(ps);
  const mean = sums.reduce((a,b) => a+b, 0)/N, oddRatio = oObs.reduce((s,v,k) => s+v*k, 0)/(6*N);
  const dup = N - new Set(DRAWS.map(d => d[1].join(","))).size;
  $("#l-facts").innerHTML = U.factsHTML([
    ["번호 합계 평균", mean.toFixed(1), "무작위라면 138.0"],
    ["홀수 비율", (oddRatio*100).toFixed(0)+"%", "무작위라면 51%"],
    ["같은 조합이 또 1등", dup+"번", "무작위라면 거의 0번"],
  ]);
}
function C(n, k){ return U.comb(n, k); }

/* 탭 */
const tabs = U.makeTabs($("#l-tabs"), name => {
  if (name === "draws" && !statsDrawn){ drawStats(); statsDrawn = true; }
  if (name === "saved") renderSaved();
}, "lotto.tab");

renderLatest();
if (N) U.drawList({ table: $("#l-drawTable"), more: $("#l-moreBtn"), form: $("#l-searchForm"), input: $("#l-searchInput"), data: DRAWS,
  head: `<th>회차</th><th>당첨번호 + 보너스</th><th class="hide-sm">1등</th>`,
  row: d => `<tr><td class="rnd"><span class="mono">${d[0]}</span>회<small>${fmtDate(d[3])}</small></td>
    <td><div class="balls-cell">${d[1].map(n => ball(n, "sm")).join("")}<span class="plus">+</span>${ball(d[2], "sm")}</div></td>
    <td class="hide-sm win1">${d[4] ? `${d[4]}명<br>${fmtWon(d[5])}` : "없음"}</td></tr>` });
updateCount();

window.GAMES = window.GAMES || {};
window.GAMES.lotto = { tabs, updated: (window.LOTTO_META || {}).updatedAt, defaultTab: () => U.sget("lotto.tab") || "gen" };
})();
