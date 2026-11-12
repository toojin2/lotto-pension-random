"""동행복권에서 연금720+ 전 회차 당첨번호를 받아 data.js 를 갱신한다.

사용법: python python/fetch_draws.py
- 요청 1회로 전체 회차(조, 1등 번호, 보너스, 추첨일)를 받는다.
- 응답 검증에 실패하거나 기존보다 회차가 줄면 data.js 를 건드리지 않는다.
"""
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone, timedelta

URL = "https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.dhlottery.co.kr/pt720/result",
}
KST = timezone(timedelta(hours=9))
DATA_JS = pathlib.Path(__file__).resolve().parent.parent / "js" / "data.js"
PREFIX = "window.DRAWS = "


def fetch():
    req = urllib.request.Request(URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        payload = json.loads(r.read().decode("utf-8"))
    items = payload["data"]["result"]
    rows = []
    for it in items:
        rnd = int(it["psltEpsd"])
        grp = int(it["wnBndNo"])
        num = str(it["wnRnkVl"]).strip()
        bonus = str(it["bnsRnkVl"]).strip()
        ymd = str(it["psltRflYmd"])
        date = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
        if not (1 <= grp <= 5 and len(num) == 6 and num.isdigit() and len(bonus) == 6 and bonus.isdigit()):
            raise ValueError(f"이상한 데이터: {it}")
        rows.append([rnd, grp, num, date, bonus])
    rows.sort()
    if [r[0] for r in rows] != list(range(1, len(rows) + 1)):
        raise ValueError("회차 누락/중복")
    return rows


def load_rows():
    try:
        text = DATA_JS.read_text(encoding="utf-8")
        start = text.index(PREFIX) + len(PREFIX)
        return json.loads(text[start:text.index(";\n", start)])
    except Exception:
        return []


def current_count():
    return len(load_rows())


def write(rows):
    meta = {"updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "source": "dhlottery.co.kr"}
    body = (
        "// 자동 생성: fetch_draws.py  [회차, 조, 1등번호, 추첨일, 보너스]\n"
        + PREFIX + json.dumps(rows, separators=(",", ":"), ensure_ascii=False) + ";\n"
        + "window.DRAWS_META = " + json.dumps(meta, ensure_ascii=False) + ";\n"
    )
    tmp = DATA_JS.with_suffix(".tmp")
    tmp.write_text(body, encoding="utf-8")
    tmp.replace(DATA_JS)


def update():
    """갱신 결과를 (기존 회차 수, 새 회차 수) 로 반환."""
    before = current_count()
    rows = fetch()
    if len(rows) < before:
        raise ValueError(f"받은 회차({len(rows)})가 기존({before})보다 적어 저장하지 않음")
    write(rows)
    return before, len(rows)


if __name__ == "__main__":
    try:
        b, a = update()
        print(f"OK: {b} -> {a}회차 (최신 {a}회)")
    except Exception as e:
        print(f"실패: {e}", file=sys.stderr)
        sys.exit(1)
