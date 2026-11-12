/* 공통 유틸: 난수, 저장소, 토스트, 탭, 차트, 통계 */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* 난수: crypto.getRandomValues + rejection sampling (편향 없음) */
const buf = new Uint8Array(64); let bi = 64;
function rbyte(){ if (bi >= buf.length){ crypto.getRandomValues(buf); bi = 0; } return buf[bi++]; }
function randInt(n){ const lim = 256 - (256 % n); let b; do { b = rbyte(); } while (b >= lim); return b % n; }

/* 저장소 (실패해도 동작) */
function loadList(key){ try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function storeList(key, list){ try { localStorage.setItem(key, JSON.stringify(list)); } catch {} }
function sget(k){ try { return sessionStorage.getItem(k); } catch { return null; } }
function sset(k, v){ try { sessionStorage.setItem(k, v); } catch {} }

let toastT;
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1600); }
async function copy(text){ try { await navigator.clipboard.writeText(text); toast("복사했습니다"); } catch { toast("복사하지 못했습니다"); } }

const fmtDate = d => { if (!d) return ""; const [y,m,dd] = d.split("-"); return `${y}.${m}.${dd}(${"일월화수목금토"[new Date(d+"T12:00:00+09:00").getDay()]})`; };
function fmtWon(n){
  if (!n) return "0원";
  const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4);
  return (eok ? `${eok.toLocaleString()}억 ` : "") + (man ? `${man.toLocaleString()}만` : "") + "원";
}
/* 마지막 추첨일 + 7일 hh:mm (KST) 기준 다음 추첨 안내 */
function nextDraw(lastDate, hh, mm){
  if (!lastDate) return "";
  const nx = new Date(`${lastDate}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00+09:00`); nx.setDate(nx.getDate() + 7);
  const kst = d => new Date(d.getTime() + 9*3600e3).toISOString().slice(0,10);
  const days = Math.round((new Date(kst(nx)) - new Date(kst(new Date()))) / 864e5);
  const t = `${hh}:${String(mm).padStart(2,"0")}`;
  return Date.now() >= nx.getTime() ? "결과 집계 중" : days === 0 ? `오늘 ${t}` : days === 1 ? `내일 ${t}` : `D-${days}`;
}

/* 세그먼트 버튼 */
function segValue(el){ return +el.querySelector('[aria-pressed="true"]').dataset.v; }
function bindSeg(el, onChange){
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b || !el.contains(b)) return;
    el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); onChange && onChange(+b.dataset.v); });
}

/* 탭 묶음 */
function makeTabs(nav, onSelect, storeKey){
  const btns = [...nav.querySelectorAll("button[role=tab]")];
  function select(btn, scroll){
    btns.forEach(b => { const on = b === btn; b.setAttribute("aria-selected", on); document.getElementById(b.getAttribute("aria-controls")).hidden = !on; });
    onSelect && onSelect(btn.dataset.tab);
    if (storeKey) sset(storeKey, btn.dataset.tab);
    if (scroll){ const top = nav.offsetTop; if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" }); }
  }
  btns.forEach(b => b.addEventListener("click", () => select(b, true)));
  return { select: (name, scroll) => select(btns.find(b => b.dataset.tab === name) || btns[0], scroll), btns };
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 막대 차트: 단일 시리즈 + 무작위 평균 점선 */
function barChart(el, { labels, values, expected, xTitle = "", labelEvery = 0 }){
  const draw = () => {
    const W = Math.max(280, el.clientWidth), H = W < 520 ? 190 : 220;
    const m = { t: 12, r: 6, b: 28, l: 32 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const maxV = Math.max(...values, ...expected);
    const raw = maxV / 5, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / mag;
    const nice = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag); // 눈금 약 5개
    const top = Math.ceil(maxV * 1.08 / nice) * nice;
    const y = v => m.t + ih - v / top * ih;
    const band = iw / labels.length, bw = Math.min(24, Math.max(3, band * 0.62));
    const cx = i => m.l + band * i + band / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(xTitle)} 막대 차트"><g class="grid axis">`;
    for (let v = 0; v <= top; v += nice) s += `<line x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}" stroke-width="${v===0?1:0.6}"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
    s += `</g><g class="axis">`;
    const every = labelEvery || (labels.length > 8 && W < 420 ? 2 : 1);
    labels.forEach((l,i) => { if (labelEvery ? ((i+1) % every === 0 || i === 0) : i % every === 0) s += `<text class="xl" x="${cx(i)}" y="${H-8}" text-anchor="middle">${esc(l)}</text>`; });
    s += `</g><g>`;
    values.forEach((v,i) => {
      const x = cx(i) - bw/2, yy = y(v), h = m.t + ih - yy, r = Math.min(4, bw/2, h);
      const path = h <= 0 ? "" : `M${x},${m.t+ih} V${yy+r} Q${x},${yy} ${x+r},${yy} H${x+bw-r} Q${x+bw},${yy} ${x+bw},${yy+r} V${m.t+ih} Z`;
      s += `<path class="bar" data-i="${i}" d="${path}"/>`;
    });
    const allSame = expected.every(e => Math.abs(e - expected[0]) < 1e-9);
    let d = "";
    if (allSame) d = `M${m.l},${y(expected[0])} H${W-m.r}`;
    else expected.forEach((e,i) => { d += `M${m.l + band*i + band*0.1},${y(e)} H${m.l + band*(i+1) - band*0.1} `; });
    s += `</g><path class="exp" d="${d}"/>`;
    values.forEach((v,i) => { s += `<rect class="hit" data-i="${i}" x="${m.l+band*i}" y="${m.t}" width="${band}" height="${ih}"/>`; });
    s += `</svg><div class="tip"></div>`;
    el.innerHTML = s;
    const tip = el.querySelector(".tip"), bars = el.querySelectorAll(".bar");
    const hide = () => { tip.classList.remove("show"); bars.forEach(b => b.classList.remove("on")); };
    el.querySelectorAll(".hit").forEach(h => {
      const i = +h.dataset.i;
      const show = () => {
        bars.forEach(b => b.classList.toggle("on", +b.dataset.i === i));
        const diff = values[i] - expected[i];
        tip.innerHTML = `<b>${esc(labels[i])}</b> · ${values[i]}회 <span class="t">(평균 ${expected[i].toFixed(1)}, ${diff>=0?"+":""}${diff.toFixed(1)})</span>`;
        const sx = el.clientWidth / W;
        tip.style.left = Math.max(100, Math.min(el.clientWidth - 100, cx(i) * sx)) + "px";
        tip.style.top = (y(Math.max(values[i], expected[i])) * sx) + "px";
        tip.classList.add("show");
      };
      h.addEventListener("mouseenter", show); h.addEventListener("touchstart", show, { passive: true }); h.addEventListener("mouseleave", hide);
    });
  };
  el._draw = draw;
  draw();
  if (!el._ro){ let rt; el._ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => el.offsetParent && el._draw(), 80); }); el._ro.observe(el); }
}
function table(el, head, labels, values, expected){
  el.innerHTML = `<table><thead><tr><th>${head}</th><th>실제</th><th>무작위 평균</th><th>차이</th></tr></thead><tbody>` +
    labels.map((l,i) => `<tr><td>${esc(l)}</td><td>${values[i]}</td><td>${expected[i].toFixed(1)}</td><td>${values[i]-expected[i]>=0?"+":""}${(values[i]-expected[i]).toFixed(1)}</td></tr>`).join("") + `</tbody></table>`;
}

/* 카이제곱 적합도 p값 */
function lgamma(z){ const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let x=z,y=z,t=x+5.5; t-=(x+0.5)*Math.log(t); let s=1.000000000190015; for(const k of c) s+=k/++y; return -t+Math.log(2.5066282746310005*s/x); }
function chi2p(x, k){ const a=k/2, z=x/2; if (z<=0) return 1;
  if (z < a+1){ let s=1/a, t=s, n=a; for(let i=0;i<500;i++){ n++; t*=z/n; s+=t; if (Math.abs(t)<1e-12*Math.abs(s)) break; } return 1 - s*Math.exp(-z+a*Math.log(z)-lgamma(a)); }
  let b=z+1-a, c=1e300, d=1/b, h=d; for(let i=1;i<500;i++){ const an=-i*(i-a); b+=2; d=an*d+b; if(!d) d=1e-300; c=b+an/c; if(!c) c=1e-300; d=1/d; const de=d*c; h*=de; if(Math.abs(de-1)<1e-12) break; }
  return Math.exp(-z+a*Math.log(z)-lgamma(a))*h; }
function chiTest(obs, exp, minExp = 5){
  const O=[],E=[]; let o=0,e=0;
  obs.forEach((v,i)=>{ o+=v; e+=exp[i]; if (e>=minExp){ O.push(o); E.push(e); o=0; e=0; } });
  if (e>0){ O[O.length-1]+=o; E[E.length-1]+=e; }
  return chi2p(O.reduce((s,v,i)=>s+(v-E[i])**2/E[i],0), O.length-1);
}
const comb = (n,k) => { if (k<0||k>n) return 0; let r=1; for(let i=1;i<=k;i++) r = r*(n-k+i)/i; return r; };

/* 판정 문구 (여러 항목을 검사한 만큼 보정) */
function verdictHTML(ps){
  const ok = Math.min(...ps) * ps.length >= 0.05;
  return ok
    ? `<span class="ic">✓</span><div><b>규칙 없음: 무작위와 똑같습니다</b><span>자주 나온 번호나 오래 안 나온 번호를 골라도 다음 회차 확률은 같습니다.</span></div>`
    : `<span class="ic">!</span><div><b>일부 항목이 평균에서 다소 벗어났습니다</b><span>우연일 가능성이 높지만, 회차가 쌓이면 다시 확인해 보세요.</span></div>`;
}
function factsHTML(list){
  return list.map(([k,v,e]) => `<div class="fact"><div class="k">${k}</div><div class="v mono">${v}</div><div class="e">${e}</div></div>`).join("");
}

/* 회차 검색 + 더보기 표 */
function drawList({ table: tbl, more, form, input, data, head, row }){
  let shown = 10, mode = "recent";
  const N = data.length, latest = data[N-1];
  function render(list){ tbl.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${list.map(row).join("")}</tbody>`; }
  function recent(){ mode = "recent"; render(data.slice(-shown).reverse()); more.hidden = shown >= N; more.textContent = "더 보기"; }
  more.onclick = () => { if (mode === "recent") shown += 20; else { shown = 10; input.value = ""; } recent(); };
  form.onsubmit = e => {
    e.preventDefault();
    const v = parseInt(input.value, 10);
    if (!v){ shown = 10; recent(); return; }
    const d = data[v-1];
    if (!d){ toast(`${v}회는 없습니다 (1~${latest[0]}회)`); return; }
    mode = "one"; render([d]); more.hidden = false; more.textContent = "최근 회차 보기";
  };
  recent();
}

window.U = { $, esc, randInt, loadList, storeList, sget, sset, toast, copy, fmtDate, fmtWon, nextDraw,
  segValue, bindSeg, makeTabs, reduceMotion, barChart, table, chiTest, comb, verdictHTML, factsHTML, drawList };
})();
