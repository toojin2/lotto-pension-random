# 복권 랜덤 번호 (비공식): 로또 6/45 + 연금복권720+

> 연습용으로 만든 개인 프로젝트입니다. 동행복권과 관련이 없습니다. 당첨번호는 참고용이며, 공식 결과는 동행복권에서 확인하세요.

## 로컬 실행
```
python python/serve.py        # http://localhost:8720
```
- 시작할 때 두 복권의 당첨번호를 동행복권에서 받아 갱신합니다.
- 추첨 시각(로또 토 20:35, 연금 목 19:05)이 지나면 새 회차가 올라올 때까지 30분마다 확인합니다. 그 외에는 6시간에 1번만 확인합니다.
- 브라우저에서 새로고침하면 바로 반영됩니다. js와 html은 캐시하지 않습니다.
- 바로가기 주소: `#lotto`, `#lotto-saved`, `#lotto-stats`, `#pension`, `#pension-saved`, `#pension-stats`

## 자동 갱신 (GitHub Actions)
웹에 공개한 사이트(GitHub Pages)는 `serve.py` 없이 GitHub Actions가 당첨번호를 갱신합니다.

- 정해진 시간에 `fetch_draws.py`와 `fetch_lotto.py`를 실행해 동행복권에서 새 회차를 받습니다.
- 새 회차가 있으면 `data.js`와 `data_lotto.js`(`js` 폴더)를 자동으로 커밋합니다. 커밋되면 Pages가 다시 배포되어 사이트에 반영됩니다.
- 새 회차가 없으면 커밋하지 않습니다.

| 실행 시각 (KST) | 대상 |
|---|---|
| 목 19:30 / 21:30 / 23:30 | 연금720+ (추첨 목 19:05) |
| 토 21:00 / 23:00 | 로또 6/45 (추첨 토 20:35) |
| 일 10:00 | 놓친 회차 보충 |

- 설정 파일: `.github/workflows/update.yml`
- 수동 실행: 저장소 **Actions** 탭 → **당첨번호 갱신** → **Run workflow**
- GitHub 예약 실행은 수십 분 늦어질 수 있습니다.
- 한쪽 복권 수집이 실패해도 다른 쪽은 따로 갱신됩니다.

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 (복권 전환 + 복권별 탭 3개) |
| `css/style.css` | 스타일 (라이트/다크) |
| `js/common.js` | 난수, 저장, 탭, 차트, 통계 공통 기능 |
| `js/lotto.js` / `js/pension.js` | 복권별 번호 생성, 내 번호, 당첨번호, 통계 |
| `js/data_lotto.js` / `js/data.js` | 당첨번호 데이터 (자동 생성) |
| `python/fetch_lotto.py` / `python/fetch_draws.py` | 동행복권 수집 (수동 실행 가능) |
| `python/serve.py` | 로컬 서버 + 자동 갱신 |
| `.github/workflows/update.yml` | GitHub Actions 자동 갱신 |
| `python/build_data.py` | 비상용: 연금복권 엑셀을 data.js로 변환 |
| `js/data_excel_backup.js`, `index_pension_only_backup.html` | 예전 버전 백업 |
| `manifest.json`, `icons/` | 아이폰 홈 화면 추가용 설정과 아이콘 |

## 데이터 출처 (동행복권 내부 JSON, GET)
- 연금720+: `/pt720/selectPstPt720WnList.do`. 한 번에 전 회차를 줍니다.
- 로또: `/lt645/selectPstLt645InfoNew.do?srchDir=older|latest&srchCursorLtEpsd=N`. 한 번에 10회차씩 줍니다.
  - `data_lotto.js`가 없을 때만 1회까지 전부 받습니다(약 125회 요청, 요청 사이 0.7초 대기).
  - 그 뒤로는 새 회차만 받습니다.
- 받은 데이터를 검증하다 실패하면 기존 데이터를 그대로 유지합니다.
- 사이트가 개편되면 주소가 바뀔 수 있습니다.
- 검증: 로또 1~1249회, 연금 1~340회 모두 동행복권 엑셀과 0건 불일치.

## 등수 판정
- 로또: 6개 일치 1등, 5개+보너스 2등, 5개 3등, 4개 4등, 3개 5등
- 연금: 조+6자리 1등, 6자리 2등, 끝 5~1자리 3~7등, 보너스 6자리(조 무관)
