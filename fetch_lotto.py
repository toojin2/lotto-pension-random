"""동행복권에서 로또 6/45 당첨번호를 받아 data_lotto.js 를 갱신한다.

사용법: python fetch_lotto.py
- 엔드포인트는 한 번에 10회차씩 준다(srchDir=older/latest + 커서).
- data_lotto.js 가 없으면 1회까지 전부 받는다(약 125회 요청, 요청 사이 0.7초 대기).
- 있으면 마지막 회차 이후만 받는다(보통 요청 1~2회).
- 검증 실패 시 기존 파일을 건드리지 않는다.
"""
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, date

from fetch_draws import KST, HEADERS as _H

URL = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do"
HEADERS = dict(_H, Referer="https://www.dhlottery.co.kr/lt645/result")
DATA_JS = pathlib.Path(__file__).with_name("data_lotto.js")
PREFIX = "window.LOTTO = "
FIRST_DRAW = date(2002, 12, 7)  # 1회 추첨일(토)
DELAY = 0.7


def _get(params):
    req = urllib.request.Request(URL + "?" + urllib.parse.urlencode(params), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))["data"]["list"] or []


def _row(it):
    nums = sorted(int(it[f"tm{i}WnNo"]) for i in range(1, 7))
    bonus = int(it["bnsWnNo"])
    ymd = str(it["ltRflYmd"])
    if len(set(nums + [bonus])) != 7 or not all(1 <= n <= 45 for n in nums + [bonus]):
        raise ValueError(f"이상한 데이터: {it.get('ltEpsd')}")
    # [회차, [번호6], 보너스, 추첨일, 1등 당첨자 수, 1등 1인당 당첨금]
    return [int(it["ltEpsd"]), nums, bonus, f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}",
            int(it.get("rnk1WnNope") or 0), int(it.get("rnk1WnAmt") or 0)]


def load():
    try:
        text = DATA_JS.read_text(encoding="utf-8")
        s = text.index(PREFIX) + len(PREFIX)
        return json.loads(text[s:text.index(";\n", s)])
    except Exception:
        return []


def fetch_newer(after):
    """after 회차 이후를 모두 받는다."""
    out, cursor = {}, after
    while True:
        items = _get({"srchDir": "latest", "srchCursorLtEpsd": str(cursor)})
        if not items:
            break
        for it in items:
            out[int(it["ltEpsd"])] = _row(it)
        top = max(out)
        if top <= cursor:
            break
        cursor = top
        time.sleep(DELAY)
    return out


def fetch_all(log=print):
    est = (datetime.now(KST).date() - FIRST_DRAW).days // 7 + 1
    out = fetch_newer(max(0, est - 30))
    if not out:
        raise ValueError("최신 회차를 찾지 못함")
    cursor = min(out)
    while cursor > 1:
        time.sleep(DELAY)
        items = _get({"srchDir": "older", "srchCursorLtEpsd": str(cursor)})
        if not items:
            break
        for it in items:
            out[int(it["ltEpsd"])] = _row(it)
        cursor = min(out)
        if cursor % 200 < 10:
            log(f"  ...{cursor}회까지 받음")
    return out


def write(rows):
    meta = {"updatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "source": "dhlottery.co.kr"}
    body = ("// 자동 생성: fetch_lotto.py  [회차, [번호6], 보너스, 추첨일, 1등 당첨자 수, 1등 1인당 당첨금]\n"
            + PREFIX + json.dumps(rows, separators=(",", ":")) + ";\n"
            + "window.LOTTO_META = " + json.dumps(meta, ensure_ascii=False) + ";\n")
    tmp = DATA_JS.with_suffix(".tmp")
    tmp.write_text(body, encoding="utf-8")
    tmp.replace(DATA_JS)


def update(log=print):
    old = load()
    if old:
        merged = {r[0]: r for r in old}
        merged.update(fetch_newer(old[-1][0]))
    else:
        log("로또 전체 회차 최초 수집 (1분 정도 걸립니다)")
        merged = fetch_all(log)
    rows = [merged[k] for k in sorted(merged)]
    if [r[0] for r in rows] != list(range(1, len(rows) + 1)):
        raise ValueError("회차 누락/중복")
    if len(rows) < len(old):
        raise ValueError("회차 수가 줄어 저장하지 않음")
    write(rows)
    return len(old), len(rows)


if __name__ == "__main__":
    try:
        b, a = update()
        print(f"OK: {b} -> {a}회차")
    except Exception as e:
        print(f"실패: {e}", file=sys.stderr)
        sys.exit(1)
