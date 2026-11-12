"""엑셀(연금720+ 회차별 당첨번호)을 site/js/data.js 로 변환.
사용법: python python/build_data.py "<엑셀 경로>"
"""
import sys, json, warnings, pathlib
import openpyxl
warnings.filterwarnings("ignore")

src = sys.argv[1]
ws = openpyxl.load_workbook(src, read_only=True).active
rows = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if not r[1]:
        continue
    rnd, grp, num = int(r[1]), int(r[2]), str(r[3]).strip().zfill(6)
    assert 1 <= grp <= 5 and len(num) == 6 and num.isdigit(), r
    rows.append([rnd, grp, num])
rows.sort()
rounds = [x[0] for x in rows]
assert rounds == list(range(1, len(rounds) + 1)), "누락/중복 회차 있음"
out = pathlib.Path(__file__).resolve().parent.parent / "js" / "data.js"
out.write_text("// 자동 생성: build_data.py\nwindow.DRAWS = " + json.dumps(rows, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{len(rows)}회차 ({rows[0][0]}~{rows[-1][0]}) -> {out}")
