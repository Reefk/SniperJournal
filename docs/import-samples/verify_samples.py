"""Reference importer + check for the sample exports in ./samples.

Parses each platform file the way a journal importer would and prints the
gross P&L it finds. All futures files describe the same day, so they must all
come out at +95.00 gross (+87.56 net of 7.44 commission).

Run:  python verify_samples.py
"""
import csv
import io
import re
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent / "samples"
POINT_VALUE = {"MNQ": 2.0, "MES": 5.0, "NQ": 20.0, "ES": 50.0}


def rows(name, skip=0):
    text = (HERE / name).read_text(encoding="utf-8-sig")
    lines = text.splitlines()[skip:]
    return list(csv.reader(io.StringIO("\n".join(lines))))


def dicts(name, skip=0):
    r = rows(name, skip)
    hdr = [h.strip() for h in r[0]]
    return [dict(zip(hdr, [c.strip() for c in x])) for x in r[1:] if any(x)]


def money(s):
    """'$1,330.10' -> 1330.1 ; '($22.48)' / '$(12.50)' / '-12.50' -> negative."""
    s = s.strip()
    neg = s.startswith("(") or s.startswith("$(") or s.startswith("-")
    v = float(re.sub(r"[^0-9.]", "", s) or 0)
    return -v if neg else v


def root(symbol):
    """'MNQ 12-26' / 'MNQZ6' / 'CME_MINI:MNQ1!' -> 'MNQ'."""
    s = symbol.split(":")[-1].split(" ")[0]
    s = re.sub(r"\d*!$", "", s)                 # MNQ1! -> MNQ
    s = re.sub(r"[FGHJKMNQUVXZ]\d{1,2}$", "", s)  # MNQZ6 -> MNQ
    return s


def fifo(fills):
    """fills: (time, symbol, signed_qty, price). Returns list of closed legs."""
    open_lots = defaultdict(deque)
    legs = []
    for t, sym, q, px in sorted(fills):
        lots = open_lots[sym]
        while q and lots and (lots[0][0] > 0) != (q > 0):
            lq, lpx = lots[0]
            n = min(abs(q), abs(lq))
            direction = 1 if lq > 0 else -1
            legs.append((sym, n, (px - lpx) * direction * n * POINT_VALUE[root(sym)]))
            lq -= direction * n
            q += direction * n
            if lq == 0:
                lots.popleft()
            else:
                lots[0] = (lq, lpx)
        if q:
            lots.append((q, px))
    return legs


results = {}

# NinjaTrader 8 -------------------------------------------------------------
d = dicts("ninjatrader8_trades.csv")
results["NinjaTrader 8 trades (Profit is NET)"] = (
    sum(money(r["Profit"]) + money(r["Commission"]) for r in d), len(d))
fills = []
for r in dicts("ninjatrader8_executions.csv"):
    t = datetime.strptime(r["Time"], "%m/%d/%Y %I:%M:%S %p")
    q = int(r["Quantity"]) * (1 if r["Action"] == "Buy" else -1)
    fills.append((t, r["Instrument"], q, float(r["Price"])))
legs = fifo(fills)
results["NinjaTrader 8 executions (FIFO)"] = (sum(x[2] for x in legs), len(legs))

# Tradovate -----------------------------------------------------------------
d = dicts("tradovate_performance.csv")
results["Tradovate performance"] = (sum(money(r["pnl"]) for r in d), len(d))
fills = []
for r in dicts("tradovate_orders.csv"):
    if r["Status"] != "Filled" or not r["Filled Qty"] or int(r["Filled Qty"]) == 0:
        continue
    t = datetime.strptime(r["Fill Time"], "%m/%d/%Y %H:%M:%S")
    q = int(r["Filled Qty"]) * (1 if r["B/S"] == "Buy" else -1)
    fills.append((t, r["Contract"], q, float(r["Avg Fill Price"])))
legs = fifo(fills)
results["Tradovate orders (FIFO)"] = (sum(x[2] for x in legs), len(legs))

# Rithmic -------------------------------------------------------------------
fills = []
for r in dicts("rithmic_rtraderpro_orders.csv", skip=1):  # skip "Completed Orders"
    if r["Status"] != "Filled":
        continue
    upd = next(v for k, v in r.items() if k.startswith("Update Time"))
    t = datetime.strptime(upd, "%Y-%m-%d %H:%M:%S")
    q = int(r["Qty Filled"]) * (1 if r["Buy/Sell"] == "B" else -1)
    fills.append((t, r["Symbol"], q, float(r["Avg Fill Price"])))
legs = fifo(fills)
results["Rithmic order history (FIFO)"] = (sum(x[2] for x in legs), len(legs))

def rithmic_performance(name):
    """Both layouts: account line / instrument line / header / trades per instrument.
    The 2026 layout adds an 'Account,Trade P&L,Commission & Fees' summary header,
    totals on the account and instrument lines, and a leading 'Trade Date' column."""
    out, account, symbol, hdr = [], None, None, None
    for r in rows(name):
        first = r[0].strip() if r else ""
        if not first or first == "Account":
            continue
        if "Entry Order Number" in r:
            hdr = r
        elif re.fullmatch(r"[A-Z0-9]{2,5}[FGHJKMNQUVXZ]\d{1,2}", first) and len(r) <= 3:
            symbol = first          # instrument line (alone, or with its totals)
        elif hdr is None or len(r) <= 3:
            account = account or first  # account line
        else:
            out.append(dict(zip(hdr, r)) | {"Symbol": symbol, "Account": account})
    return out


for name, label in (("rithmic_rtraderpro_performance.csv", "Rithmic trade performance"),
                    ("rithmic_rtraderpro_performance_2026.csv", "Rithmic trade performance 2026")):
    perf = rithmic_performance(name)
    assert all(p["Symbol"] in ("MESZ6", "MNQZ6") for p in perf), perf
    results[label] = (sum(float(r["Trade P&L"]) for r in perf), len(perf))

# TopstepX ------------------------------------------------------------------
d = dicts("topstepx_trades.csv")
for r in d:
    datetime.fromisoformat(r["EnteredAt"])  # must carry a UTC offset
results["TopstepX trades"] = (sum(float(r["PnL"]) for r in d), len(d))

# TradingView ---------------------------------------------------------------
fills = []
for r in dicts("tradingview_paper_history.csv"):
    if r["Status"] != "Filled":
        continue
    t = datetime.strptime(r["Closing Time"], "%Y-%m-%d %H:%M:%S")
    q = int(r["Qty"]) * (1 if r["Side"] == "Buy" else -1)
    fills.append((t, r["Symbol"], q, float(r["Fill Price"])))
legs = fifo(fills)
results["TradingView history (FIFO)"] = (sum(x[2] for x in legs), len(legs))
d = dicts("tradingview_paper_account_history.csv")
results["TradingView account history"] = (sum(float(r["Realized P&L (value)"]) for r in d), len(d))

# ------------------------------------------------------------------ report
print(f"{'source':42} {'gross P&L':>10} {'legs':>5}")
ok = True
for k, (pnl, n) in results.items():
    flag = "OK" if abs(pnl - 95.00) < 0.005 else "MISMATCH"
    ok &= flag == "OK"
    print(f"{k:42} {pnl:10.2f} {n:5}  {flag}")

# MetaTrader (forex/CFD): Positions vs Deals vs MT4 must agree --------------
mt5p = rows("metatrader5_positions.csv")[1:]  # duplicate 'Time'/'Price' headers -> by index
net_p = sum(float(r[10]) + float(r[11]) + float(r[12]) for r in mt5p)
deals = dicts("metatrader5_deals.csv")
net_d = sum(float(r["Commission"]) + float(r["Fee"]) + float(r["Swap"]) + float(r["Profit"])
            for r in deals if r["Type"] != "balance")
mt4 = [r for r in rows("metatrader4_account_history.csv")[1:] if r[2] in ("buy", "sell")]
net_4 = sum(float(r[10]) + float(r[11]) + float(r[12]) + float(r[13]) for r in mt4)
final_bal = float(deals[-1]["Balance"]) - 10000
print(f"\nMT5 positions net {net_p:.2f} | MT5 deals net {net_d:.2f} | MT4 net {net_4:.2f} "
      f"| balance change {final_bal:.2f}")
ok &= len({round(x, 2) for x in (net_p, net_d, net_4, final_bal)}) == 1

# Interactive Brokers: statement vs flex ------------------------------------
trades = [r for r in rows("interactivebrokers_activity_statement.csv")
          if r[:3] == ["Trades", "Data", "Order"]]
realized = sum(float(r[13]) for r in trades)
datetime.strptime(trades[0][6], "%Y-%m-%d, %H:%M:%S")
flex = dicts("interactivebrokers_flex_trades.csv")
flex_cash = sum(float(r["NetCash"]) for r in flex)
print(f"IBKR statement realized {realized:.2f} | IBKR flex net cash {flex_cash:.2f}")
ok &= abs(realized - flex_cash) < 0.005

# thinkorswim: cut the 'Account Trade History' section out of the statement --
lines = (HERE / "thinkorswim_account_statement.csv").read_text(encoding="utf-8-sig").splitlines()
start = lines.index("Account Trade History") + 1
end = lines.index("", start)
tos = list(csv.DictReader(lines[start:end]))
cash_amt = sum(-float(r["Qty"]) * float(r["Price"]) for r in tos)
print(f"thinkorswim trade history: {len(tos)} fills, gross {cash_amt:.2f}")
ok &= abs(cash_amt - 252.50) < 0.005

print("\nALL CHECKS PASSED" if ok else "\nSOME CHECKS FAILED")
