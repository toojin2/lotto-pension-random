"""로컬 서버 + 자동 갱신 (연금720+, 로또 6/45).

python serve.py [포트=8720]
- 시작 시 두 복권 모두 동행복권에서 갱신한다.
- 마지막 추첨일 + 7일의 추첨 시각(연금 목 19:05, 로또 토 20:35) + 25분이 지나면
  새 회차가 올라올 때까지 30분 간격으로 확인한다. 그 외에는 6시간마다 1회만 확인한다.
- js/html 은 캐시하지 않게 내보내 새로고침하면 바로 반영된다.
"""
import functools
import http.server
import pathlib
import sys
import threading
import time
from datetime import datetime, timedelta

import fetch_draws
import fetch_lotto
from fetch_draws import KST

ROOT = pathlib.Path(__file__).parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8720


def _pension_last():
    rows = fetch_draws.load_rows()
    return (rows[-1][0], rows[-1][3]) if rows and len(rows[-1]) > 3 else (0, None)


def _lotto_last():
    rows = fetch_lotto.load()
    return (rows[-1][0], rows[-1][3]) if rows else (0, None)


GAMES = [
    # 이름, 갱신 함수, (마지막 회차, 추첨일) 함수, 추첨 시각
    ("연금720", fetch_draws.update, _pension_last, (19, 30)),
    ("로또", lambda: fetch_lotto.update(log), _lotto_last, (21, 0)),
]


def log(msg):
    print(f"[{datetime.now(KST):%m-%d %H:%M}] {msg}", flush=True)


def behind(last_fn, hm):
    _, d = last_fn()
    if not d:
        return True
    nxt = datetime.fromisoformat(d).replace(hour=hm[0], minute=hm[1], tzinfo=KST) + timedelta(days=7)
    return datetime.now(KST) >= nxt


def updater():
    last_try = {g[0]: 0.0 for g in GAMES}
    while True:
        for name, upd, last_fn, hm in GAMES:
            interval = 30 * 60 if behind(last_fn, hm) else 6 * 3600
            if last_try[name] == 0 or time.time() - last_try[name] >= interval:
                last_try[name] = time.time()
                try:
                    b, a = upd()
                    log(f"{name} 갱신 확인: {b} -> {a}회차" + (" (새 회차!)" if a > b else ""))
                except Exception as e:
                    log(f"{name} 갱신 실패(기존 데이터 유지): {e}")
        time.sleep(60)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.split("?")[0].endswith((".js", ".html", "/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(target=updater, daemon=True).start()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=str(ROOT)))
    log(f"http://localhost:{PORT} 에서 실행 중")
    srv.serve_forever()
