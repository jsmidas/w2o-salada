# -*- coding: utf-8 -*-
"""
W2O SALADA 새벽배송 손익분기 시뮬레이터 생성 스크립트
- 주 2회(화·목) 새벽배송 기준
- 가정값 시트의 셀만 바꾸면 손익/손익분기가 자동 재계산되는 수식 기반 모델
- 가정값은 한국 새벽배송 업계 일반 추정치로 초기화
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

WON = '#,##0"원"'
WON_PLAIN = '#,##0'
PCT = '0.0%'
NUM1 = '0.0'

# ---- 스타일 ----
title_font = Font(name="맑은 고딕", size=15, bold=True, color="FFFFFF")
title_fill = PatternFill("solid", fgColor="1D9E75")
sec_font = Font(name="맑은 고딕", size=11, bold=True, color="0A1A0F")
sec_fill = PatternFill("solid", fgColor="C8EDDD")
label_font = Font(name="맑은 고딕", size=10)
input_font = Font(name="맑은 고딕", size=10, bold=True, color="9C5700")
input_fill = PatternFill("solid", fgColor="FFF3C4")  # 노란색 = 입력 셀
calc_font = Font(name="맑은 고딕", size=10)
result_font = Font(name="맑은 고딕", size=11, bold=True)
result_fill = PatternFill("solid", fgColor="EAF6F1")
note_font = Font(name="맑은 고딕", size=9, italic=True, color="6B7280")

thin = Side(style="thin", color="D0D7DE")
box = Border(left=thin, right=thin, top=thin, bottom=thin)


def style_block(ws, cell_range, font=None, fill=None, fmt=None, border=False, align=None):
    for row in ws[cell_range]:
        for c in row:
            if font:
                c.font = font
            if fill:
                c.fill = fill
            if fmt:
                c.number_format = fmt
            if border:
                c.border = box
            if align:
                c.alignment = align


wb = Workbook()

# =========================================================
# 1) 가정값 시트
# =========================================================
A = wb.active
A.title = "가정값"
A.sheet_view.showGridLines = False
A.column_dimensions["A"].width = 3
A.column_dimensions["B"].width = 26
A.column_dimensions["C"].width = 16
A.column_dimensions["D"].width = 10
A.column_dimensions["E"].width = 44

A["B1"] = "W2O SALADA · 새벽배송 손익분기 시뮬레이터"
A.merge_cells("B1:E1")
A["B1"].font = title_font
A["B1"].fill = title_fill
A["B1"].alignment = Alignment(horizontal="center", vertical="center")
A.row_dimensions[1].height = 30

A["B2"] = "노란 셀 = 직접 입력하는 가정값 · 나머지 시트는 자동 계산됩니다 (주 2회 화·목 배송 기준)"
A.merge_cells("B2:E2")
A["B2"].font = note_font

# (라벨, 값, 단위, 셀주소키, 설명)
ref = {}
row = 4


def section(name):
    global row
    A.cell(row=row, column=2, value=name)
    A.merge_cells(start_row=row, start_column=2, end_row=row, end_column=5)
    style_block(A, f"B{row}:E{row}", font=sec_font, fill=sec_fill)
    A.row_dimensions[row].height = 22
    row += 1


def assume(key, label, value, unit, note, fmt=WON_PLAIN):
    global row
    A.cell(row=row, column=2, value=label).font = label_font
    vc = A.cell(row=row, column=3, value=value)
    vc.font = input_font
    vc.fill = input_fill
    vc.number_format = fmt
    vc.border = box
    vc.alignment = Alignment(horizontal="right")
    A.cell(row=row, column=4, value=unit).font = note_font
    A.cell(row=row, column=5, value=note).font = note_font
    ref[key] = f"가정값!$C${row}"
    row += 1


section("① 매출 가정")
assume("aov", "객단가 (평균 결제액)", 18000, "원", "본품 최소 11,000원 + 음료·추가구성 평균. 업계 샐러드 새벽배송 1.5~2.5만")
assume("daily", "배송일당 주문 수", 80, "건", "이 값을 바꿔가며 손익분기 확인 (기본 시나리오)")
assume("freq", "주 배송 횟수", 2, "회", "화·목 = 2회 (Weekly 2 Order)", WON_PLAIN)
assume("weeks", "월 평균 주 수", 4.345, "주", "52주 ÷ 12개월 = 4.345", NUM1)

section("② 변동비 가정 (주문 1건당)")
assume("cogs", "식자재 원가율", 0.38, "%", "샐러드·신선 HMR 통상 35~42%", PCT)
assume("waste", "폐기율 (식자재 대비)", 0.05, "%", "예측생산 신선식품 통상 3~8%", PCT)
assume("pack", "건당 포장재비", 1200, "원", "보냉박스+아이스팩+용기 (비회수 기준)")
assume("pg", "PG 수수료율", 0.033, "%", "토스페이먼츠 약 3.3%", PCT)
assume("alim", "건당 알림톡비", 40, "원", "주문완료+출발+완료 3건 × 12~15원")

section("③ 배송 가정 (최소비용 보장 용역)")
assume("dlvGuar", "코스 최소 보장액", 100000, "원",
       "집수가 적어도 코스당 최소 지급액. 7만~10만 협의 중 — 이 값만 바꾸면 전체 재계산")
assume("dlvPer", "집당 배송 단가", 1000, "원",
       "한 집 = 1건 (한 집에 샐러드·반찬이 함께 가도 1건)")
assume("dlvMax", "코스당 최대 집수", 200, "집",
       "기사 1명이 새벽 4시간에 도는 물리 한계. 아파트 밀집이면 ↑, 단독주택이면 ↓")

section("④ 고정비 가정 (월)")
assume("rent", "주방 임대·관리비", 2500000, "원", "공유주방~소형 센터 초기 기준")
assume("labor", "인건비", 12000000, "원", "조리·포장·CS 4~5명 초기 소규모")
assume("car", "냉장설비", 500000, "원",
       "냉장고·쇼케이스 유지·전기. 배송 차량은 용차(변동비)라 고정비에 넣지 않는다")
assume("mkt", "마케팅비", 3000000, "원", "신규 유입 광고 (초기 공격 시 ↑)")
assume("etc", "기타 운영비", 1000000, "원", "SW·결제·보험·잡비")

last_assume_row = row - 1

# =========================================================
# 2) 손익 시트 (월 손익계산서)
# =========================================================
P = wb.create_sheet("손익")
P.sheet_view.showGridLines = False
P.column_dimensions["A"].width = 3
P.column_dimensions["B"].width = 28
P.column_dimensions["C"].width = 16
P.column_dimensions["D"].width = 14
P.column_dimensions["E"].width = 40

P["B1"] = "월간 손익계산서 (현재 가정값 기준)"
P.merge_cells("B1:E1")
P["B1"].font = title_font
P["B1"].fill = title_fill
P["B1"].alignment = Alignment(horizontal="center", vertical="center")
P.row_dimensions[1].height = 28

pr = 3


def pline(label, formula, fmt=WON, bold=False, fill=False, note=""):
    global pr
    P.cell(row=pr, column=2, value=label).font = result_font if bold else label_font
    vc = P.cell(row=pr, column=3, value=formula)
    vc.font = result_font if bold else calc_font
    vc.number_format = fmt
    vc.border = box
    vc.alignment = Alignment(horizontal="right")
    if fill:
        P.cell(row=pr, column=2).fill = result_fill
        vc.fill = result_fill
    if note:
        P.cell(row=pr, column=5, value=note).font = note_font
    cur = f"손익!$C${pr}"
    pr += 1
    return cur


def psection(name):
    global pr
    P.cell(row=pr, column=2, value=name)
    P.merge_cells(start_row=pr, start_column=2, end_row=pr, end_column=5)
    style_block(P, f"B{pr}:E{pr}", font=sec_font, fill=sec_fill)
    pr += 1


psection("물량")
mdays = pline("월 배송일 수", f"={ref['freq']}*{ref['weeks']}", NUM1, note="주 배송횟수 × 월평균주수")
morders = pline("월 주문 건수", f"={ref['daily']}*{mdays}", WON_PLAIN, note="배송일당 주문수 × 월 배송일수")

# 배송비는 건당 고정이 아니다. 용차가 최소비용 보장 용역이라
#   코스 정산액 = max(보장액, 집수 × 집당단가)
# 이고, 물량이 분기점(보장액 ÷ 단가)을 넘으면 건당 원가가 단가로 수렴한다.
psection("배송 (최소비용 보장 구조)")
d_bep = pline("코스 분기점", f"={ref['dlvGuar']}/{ref['dlvPer']}", WON_PLAIN,
              note="보장액 ÷ 집당단가. 이 집수를 넘으면 건당 원가가 단가로 고정된다")
d_routes = pline("배송일당 코스 수", f"=MAX(1,CEILING({ref['daily']}/{ref['dlvMax']},1))", NUM1,
                 note="집수 ÷ 코스당 최대집수 (올림). 코스를 더 나눠도 분기점 이상이면 총액은 같다")
d_cost = pline("배송일당 배송비", f"=MAX({d_routes}*{ref['dlvGuar']},{ref['daily']}*{ref['dlvPer']})",
               WON, note="max(코스수 × 보장액, 집수 × 단가)")
d_unit = pline("실질 건당 배송비", f"=IF({ref['daily']}=0,0,{d_cost}/{ref['daily']})", WON,
               bold=True, fill=True, note="물량이 분기점 미만이면 보장액 때문에 올라간다")

psection("매출")
rev = pline("월 매출액", f"={ref['aov']}*{morders}", WON, bold=True, fill=True, note="객단가 × 월 주문건수")

psection("변동비 (주문 1건당)")
v_cogs = pline("식자재비", f"={ref['aov']}*{ref['cogs']}", WON, note="객단가 × 원가율")
v_waste = pline("폐기 손실", f"={v_cogs}*{ref['waste']}", WON, note="식자재비 × 폐기율")
v_pack = pline("포장재비", f"={ref['pack']}", WON)
v_ship = pline("배송비 (실질 건당)", f"={d_unit}", WON, note="위 배송 섹션에서 계산 — 물량에 따라 변한다")
v_pg = pline("PG 수수료", f"={ref['aov']}*{ref['pg']}", WON, note="객단가 × PG율")
v_alim = pline("알림톡비", f"={ref['alim']}", WON)
v_sum = pline("건당 변동비 합계", f"={v_cogs}+{v_waste}+{v_pack}+{v_ship}+{v_pg}+{v_alim}",
              WON, bold=True, fill=True)

psection("공헌이익")
cm_unit = pline("건당 공헌이익", f"={rev}/{morders}-{v_sum}", WON, bold=True, fill=True,
                note="객단가 − 건당 변동비")
cm_rate = pline("공헌이익률", f"={cm_unit}/{ref['aov']}", PCT, bold=True)
cm_month = pline("월 공헌이익", f"={cm_unit}*{morders}", WON, bold=True, fill=True)

psection("고정비 (월)")
f_rent = pline("주방 임대·관리비", f"={ref['rent']}")
f_labor = pline("인건비", f"={ref['labor']}")
f_car = pline("냉장설비", f"={ref['car']}", note="배송 차량은 용차라 위 배송 섹션의 변동비로 잡힌다")
f_mkt = pline("마케팅비", f"={ref['mkt']}")
f_etc = pline("기타 운영비", f"={ref['etc']}")
f_sum = pline("월 고정비 합계", f"={f_rent}+{f_labor}+{f_car}+{f_mkt}+{f_etc}",
              WON, bold=True, fill=True)

psection("영업손익")
op = pline("월 영업이익", f"={cm_month}-{f_sum}", WON, bold=True, fill=True,
           note="월 공헌이익 − 월 고정비")
op_rate = pline("영업이익률", f"=IF({rev}=0,0,{op}/{rev})", PCT, bold=True)

# =========================================================
# 3) 손익분기 시트
# =========================================================
B = wb.create_sheet("손익분기")
B.sheet_view.showGridLines = False
B.column_dimensions["A"].width = 3
B.column_dimensions["B"].width = 26
B.column_dimensions["C"].width = 16
B.column_dimensions["D"].width = 14
for col in "EFGHIJ":
    B.column_dimensions[col].width = 15

B["B1"] = "손익분기점 (BEP) 분석"
B.merge_cells("B1:J1")
B["B1"].font = title_font
B["B1"].fill = title_fill
B["B1"].alignment = Alignment(horizontal="center", vertical="center")
B.row_dimensions[1].height = 28

B["B3"] = "핵심 지표"
B.merge_cells("B3:C3")
style_block(B, "B3:C3", font=sec_font, fill=sec_fill)


def bline(r, label, formula, fmt=WON, bold=True):
    B.cell(row=r, column=2, value=label).font = result_font if bold else label_font
    vc = B.cell(row=r, column=3, value=formula)
    vc.font = result_font if bold else calc_font
    vc.number_format = fmt
    vc.border = box
    vc.fill = result_fill
    vc.alignment = Alignment(horizontal="right")
    B.cell(row=r, column=2).fill = result_fill
    return f"손익분기!$C${r}"


bep_orders = bline(4, "손익분기 월 주문건수", f"={f_sum}/{cm_unit}", WON_PLAIN)
bep_daily = bline(5, "손익분기 배송일당 주문수", f"={bep_orders}/{mdays}", WON_PLAIN)
bep_rev = bline(6, "손익분기 월 매출액", f"={bep_orders}*{ref['aov']}", WON)
bep_safety = bline(7, "현재 가정 대비 안전마진",
                   f"=IF({morders}=0,0,({morders}-{bep_orders})/{morders})", PCT)
bep_status = bline(8, "현재 가정 손익 상태",
                   f'=IF({op}>=0,"흑자 (BEP 통과)","적자 (BEP 미달)")', "General")
B.cell(row=9, column=2,
       value="※ 위 BEP는 현재 가정값의 건당 배송비를 그대로 적용한 값입니다. "
             "물량이 코스 분기점 미만이면 배송비가 올라가므로 아래 민감도 표를 함께 보세요.").font = note_font
B.merge_cells("B9:J9")

B["B11"] = "민감도 — 배송일당 집수별 월 영업이익 (배송비를 물량에 맞춰 재계산)"
B.merge_cells("B11:J11")
style_block(B, "B11:J11", font=sec_font, fill=sec_fill)

hdr = ["배송일당 집수", "코스 수", "건당 배송비", "월 주문건수", "월 매출",
       "월 공헌이익", "월 고정비", "월 영업이익", "손익"]
for i, h in enumerate(hdr):
    c = B.cell(row=12, column=2 + i, value=h)
    c.font = Font(name="맑은 고딕", size=9, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1D9E75")
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = box
B.row_dimensions[12].height = 30

scenarios = [20, 40, 60, 80, 100, 120, 150, 200, 250, 300]
r = 13
for d in scenarios:
    dcell = f"$B${r}"
    B.cell(row=r, column=2, value=d).number_format = WON_PLAIN
    # 코스 수 = 집수 ÷ 코스당 최대집수 (올림, 최소 1)
    B.cell(row=r, column=3,
           value=f"=MAX(1,CEILING({dcell}/{ref['dlvMax']},1))").number_format = NUM1
    # 건당 배송비 = max(코스수 × 보장액, 집수 × 단가) ÷ 집수
    B.cell(row=r, column=4,
           value=f"=MAX($C{r}*{ref['dlvGuar']},{dcell}*{ref['dlvPer']})/{dcell}").number_format = WON
    # 월 주문건수 = 배송일당 × 월배송일수
    B.cell(row=r, column=5, value=f"={dcell}*{mdays}").number_format = WON_PLAIN
    # 월 매출
    B.cell(row=r, column=6, value=f"=$E{r}*{ref['aov']}").number_format = WON
    # 월 공헌이익 — 손익 시트의 건당 공헌이익에서 배송비만 이 행의 값으로 치환
    B.cell(row=r, column=7,
           value=f"=({cm_unit}+{v_ship}-$D{r})*$E{r}").number_format = WON
    # 월 고정비
    B.cell(row=r, column=8, value=f"={f_sum}").number_format = WON
    # 월 영업이익
    B.cell(row=r, column=9, value=f"=$G{r}-$H{r}").number_format = WON
    # 손익
    B.cell(row=r, column=10,
           value=f'=IF($I{r}>=0,"흑자","적자")').number_format = "General"
    for col in range(2, 11):
        cell = B.cell(row=r, column=col)
        cell.border = box
        cell.alignment = Alignment(horizontal="right")
        if cell.font is None or cell.font.name != "맑은 고딕":
            cell.font = calc_font
    r += 1

# ---- 보장액이 아직 확정되지 않았으므로 금액별로 나란히 비교한다 ----
r += 1
B.cell(row=r, column=2,
       value="민감도 — 코스 최소 보장액별 실질 건당 배송비 (보장액 확정 전 비교용)")
B.merge_cells(start_row=r, start_column=2, end_row=r, end_column=10)
style_block(B, f"B{r}:J{r}", font=sec_font, fill=sec_fill)
r += 1

guarantees = [70000, 80000, 90000, 100000, 120000]
ghdr = ["배송일당 집수"] + [f"보장액 {g // 10000}만 원" for g in guarantees]
for i, h in enumerate(ghdr):
    c = B.cell(row=r, column=2 + i, value=h)
    c.font = Font(name="맑은 고딕", size=9, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="EF9F27")
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = box
B.row_dimensions[r].height = 28
r += 1

for d in [40, 60, 80, 100, 120, 150, 200, 300]:
    dcell = f"$B${r}"
    routes = f"MAX(1,CEILING({dcell}/{ref['dlvMax']},1))"
    B.cell(row=r, column=2, value=d).number_format = WON_PLAIN
    for i, g in enumerate(guarantees):
        # 코스 수는 보장액과 무관하게 물리 한계로 결정된다
        B.cell(row=r, column=3 + i,
               value=f"=MAX({routes}*{g},{dcell}*{ref['dlvPer']})/{dcell}").number_format = WON
    for col in range(2, 3 + len(guarantees)):
        cell = B.cell(row=r, column=col)
        cell.border = box
        cell.alignment = Alignment(horizontal="right")
        cell.font = calc_font
    r += 1

B.cell(row=r + 1, column=2,
       value="※ 노란 셀(가정값 시트)을 바꾸면 모든 수치가 자동 재계산됩니다. "
             "보장액은 협의에 따라 바뀔 수 있으므로 위 표에서 금액별 영향을 먼저 확인하세요.").font = note_font
B.merge_cells(start_row=r + 1, start_column=2, end_row=r + 1, end_column=10)

# =========================================================
# 4) 시나리오 시트 (고정비 규모별 비교)
# =========================================================
# BEP는 고정비가 지배한다. 오픈 초기에 어느 규모로 시작할지가
# "몇 집을 모아야 흑자인가"를 결정하므로, 규모별로 나란히 비교한다.
S = wb.create_sheet("시나리오")
S.sheet_view.showGridLines = False
S.column_dimensions["A"].width = 3
S.column_dimensions["B"].width = 26
for col in "CDE":
    S.column_dimensions[col].width = 17
S.column_dimensions["F"].width = 42

S["B1"] = "고정비 시나리오 비교 — 어느 규모로 시작할 것인가"
S.merge_cells("B1:F1")
S["B1"].font = title_font
S["B1"].fill = title_fill
S["B1"].alignment = Alignment(horizontal="center", vertical="center")
S.row_dimensions[1].height = 28

S["B2"] = ("노란 셀을 바꾸면 BEP가 자동 재계산됩니다 · "
           "배송 차량은 용차(변동비)라 고정비에 넣지 않습니다")
S.merge_cells("B2:F2")
S["B2"].font = note_font

sc_names = ["A. 안정기", "B. 축소 운영", "C. 최소 시작"]
sr = 4
hc = S.cell(row=sr, column=2, value="고정비 항목 (월)")
hc.font = Font(name="맑은 고딕", size=10, bold=True, color="FFFFFF")
hc.fill = PatternFill("solid", fgColor="1D9E75")
hc.border = box
for i, n in enumerate(sc_names):
    c = S.cell(row=sr, column=3 + i, value=n)
    c.font = Font(name="맑은 고딕", size=10, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1D9E75")
    c.alignment = Alignment(horizontal="center")
    c.border = box
sr += 1

sc_items = [
    ("주방 임대·관리비", 2500000, 1000000, 0, "모회사 주방 공유 시 0 또는 분담"),
    ("인건비", 12000000, 6000000, 4000000, "C는 겸업·파트타임 기준"),
    ("냉장설비", 500000, 300000, 0, "배송 차량은 용차라 제외"),
    ("마케팅비", 3000000, 1500000, 1000000, "초기엔 단지 단위 영업이 더 싸다"),
    ("기타 운영비", 1000000, 700000, 500000, "SW·결제·보험·잡비"),
]
first_item = sr
for label, a, b, c_, note in sc_items:
    S.cell(row=sr, column=2, value=label).font = label_font
    for i, v in enumerate([a, b, c_]):
        vc = S.cell(row=sr, column=3 + i, value=v)
        vc.font = input_font
        vc.fill = input_fill
        vc.number_format = WON
        vc.border = box
        vc.alignment = Alignment(horizontal="right")
    S.cell(row=sr, column=6, value=note).font = note_font
    sr += 1
last_item = sr - 1

# 배송비를 뺀 건당 공헌이익 — BEP 계산의 기준
cm_ex = f"({cm_unit}+{v_ship})"

def srow(label, fml_by_col, fmt=WON, bold=True, note=""):
    global sr
    S.cell(row=sr, column=2, value=label).font = result_font if bold else label_font
    S.cell(row=sr, column=2).fill = result_fill
    for i in range(3):
        col = get_column_letter(3 + i)
        vc = S.cell(row=sr, column=3 + i, value=fml_by_col(col))
        vc.font = result_font if bold else calc_font
        vc.number_format = fmt
        vc.border = box
        vc.fill = result_fill
        vc.alignment = Alignment(horizontal="right")
    if note:
        S.cell(row=sr, column=6, value=note).font = note_font
    cur = sr
    sr += 1
    return cur

total_row = srow("월 고정비 합계",
                 lambda col: f"=SUM({col}{first_item}:{col}{last_item})",
                 note="항목 합계")

# BEP는 물량이 코스 분기점을 넘느냐에 따라 식이 달라진다.
#  - 분기점 이상: 건당 배송비가 집당 단가로 고정 → 단순 나눗셈
#  - 분기점 미만: 보장액이 그대로 나가므로 고정비에 더해서 계산
def bep_formula(col):
    fixed = f"{col}{total_row}"
    high = f"({fixed}/(({cm_ex}-{ref['dlvPer']})*{mdays}))"
    low = f"(({fixed}/{mdays}+{ref['dlvGuar']})/{cm_ex})"
    return f"=ROUNDUP(IF({high}>={d_bep},{high},{low}),0)"

bep_row = srow("손익분기 배송일당 집수", bep_formula, WON_PLAIN,
               note="이 집수를 넘으면 흑자. 분기점 미만 구간은 보장액을 반영해 계산")
srow("손익분기 월 주문 건수", lambda col: f"={col}{bep_row}*{mdays}", WON_PLAIN)
srow("현재 가정 물량의 월 영업이익",
     lambda col: f"={cm_unit}*{morders}-{col}{total_row}", WON,
     note="가정값 시트의 '배송일당 주문 수' 기준")

sr += 1
S.cell(row=sr, column=2, value="물량별 월 영업이익 비교")
S.merge_cells(start_row=sr, start_column=2, end_row=sr, end_column=6)
style_block(S, f"B{sr}:F{sr}", font=sec_font, fill=sec_fill)
sr += 1

c = S.cell(row=sr, column=2, value="배송일당 집수")
c.font = Font(name="맑은 고딕", size=9, bold=True, color="FFFFFF")
c.fill = PatternFill("solid", fgColor="EF9F27")
c.alignment = Alignment(horizontal="center")
c.border = box
for i, n in enumerate(sc_names):
    c = S.cell(row=sr, column=3 + i, value=n)
    c.font = Font(name="맑은 고딕", size=9, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="EF9F27")
    c.alignment = Alignment(horizontal="center")
    c.border = box
sr += 1

for d in [50, 80, 100, 150, 200, 300, 400]:
    dcell = f"$B${sr}"
    S.cell(row=sr, column=2, value=d).number_format = WON_PLAIN
    routes = f"MAX(1,CEILING({dcell}/{ref['dlvMax']},1))"
    ship = f"(MAX({routes}*{ref['dlvGuar']},{dcell}*{ref['dlvPer']})/{dcell})"
    for i in range(3):
        col = get_column_letter(3 + i)
        S.cell(row=sr, column=3 + i,
               value=f"=({cm_ex}-{ship})*{dcell}*{mdays}-{col}{total_row}").number_format = WON
    for col_i in range(2, 6):
        cell = S.cell(row=sr, column=col_i)
        cell.border = box
        cell.alignment = Alignment(horizontal="right")
        cell.font = calc_font
    sr += 1

S.cell(row=sr + 1, column=2,
       value="※ 고정비를 100만 원 줄이면 BEP가 약 14~15집 내려갑니다. "
             "수요가 불확실한 초기에는 고정비를 변동비로 바꾸는 편이 안전합니다.").font = note_font
S.merge_cells(start_row=sr + 1, start_column=2, end_row=sr + 1, end_column=6)

# 시트 순서: 가정값 → 손익 → 손익분기 → 시나리오
wb.move_sheet("손익분기", offset=0)
wb.active = 0

out = r"c:\Users\js\Desktop\dev\w2o-salada\새벽배송_손익분기_시뮬레이터.xlsx"
wb.save(out)
print("저장 완료:", out)
