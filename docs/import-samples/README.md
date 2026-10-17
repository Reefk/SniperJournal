# קבצי ייצוא עסקאות לדוגמה, 8 פלטפורמות

16 קבצי CSV במבנה הייצוא של NinjaTrader 8, Tradovate, Rithmic R|Trader Pro, TopstepX, TradingView, MetaTrader 4/5, Interactive Brokers ו-thinkorswim, לבדיקת מנגנון הייבוא של Sniper Journal.

## מה יש כאן, ומה לא

אף אחד לא מפרסם קבצי ייצוא אמיתיים מחשבונות, ולכן אלה לא קבצים שהורדו מחשבון. **הכותרות והמבנה** לקוחים מקבצי ייצוא אמיתיים (fixtures) שנמצאים בפרויקטים של יומני מסחר בקוד פתוח, ומהמדריכים של TradeZella, Tradesyncer וכו'. **הערכים** סינתטיים.

כל קבצי החוזים העתידיים מתארים את אותו יום מסחר (14.10.2026, שעון ניו יורק), כך שלכל הקבצים יש תשובה נכונה אחת:

| עסקה | חוזה  | כיוון | כמות | כניסה               | יציאה               | P&L ברוטו |
| ---- | ----- | ----- | ---- | ------------------- | ------------------- | --------- |
| T1   | MNQZ6 | Long  | 2    | 21450.25 ב-09:35:12 | 21462.75 ב-09:41:48 | +50.00    |
| T2   | MESZ6 | Short | 1    | 6085.50 ב-10:02:05  | 6088.00 ב-10:07:30  | ‎-12.50   |
| T3a  | MNQZ6 | Short | 2    | 21480.00 ב-10:31:20 | 21471.50 ב-10:44:02 | +34.00    |
| T3b  | MNQZ6 | Short | 1    | 21480.00 ב-10:31:20 | 21468.25 ב-10:52:40 | +23.50    |

סה"כ: **‎+95.00 ברוטו**, עמלה 7.44 (0.62 לחוזה לכל צד), **‎+87.56 נטו**. עסקה T3 היא יציאה חלקית (scale-out), וכל פלטפורמה מפצלת אותה לשתי שורות.

`verify_samples.py` הוא מייבא לדוגמה: הוא קורא את כל 16 הקבצים, מצמיד מילויים (fills) ב-FIFO, ומוודא שכולם מגיעים לאותה תוצאה. אפשר להעתיק ממנו את הלוגיקה לאפליקציה.

### רמת הוודאות לכל קובץ

| קובץ                                                        | מקור הכותרות                                                                                                              | ודאות         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `ninjatrader8_trades.csv`                                   | fixture אמיתי (chartjot)                                                                                                  | גבוהה         |
| `ninjatrader8_executions.csv`                               | fixture אמיתי (chartjot)                                                                                                  | גבוהה         |
| `tradovate_performance.csv`                                 | fixture (tilt-check) + Deltalytix                                                                                         | גבוהה         |
| `tradovate_orders.csv`                                      | כל 26 העמודות, לפי הרשימה במדריך של TradeZella                                                                            | גבוהה         |
| `rithmic_rtraderpro_orders.csv`                             | שמות עמודות לפי TradeZella; הסדר תלוי בהגדרת העמודות שלך                                                                  | בינונית       |
| `rithmic_rtraderpro_performance.csv`                        | המבנה הישן, לפי המייבא והבדיקות של Deltalytix                                                                             | בינונית-גבוהה |
| `rithmic_rtraderpro_performance_2026.csv`                   | המבנה החדש (מאמצע 2026), לפי Deltalytix                                                                                   | בינונית-גבוהה |
| `topstepx_trades.csv`                                       | 11 העמודות מאומתות (TradeNote); תאריך ISO 8601 עם offset לפי שני מקורות, אבל ה-offset עצמו (UTC או שעון ניו יורק) לא אומת | בינונית-גבוהה |
| `tradingview_paper_history.csv`                             | importer בקוד פתוח (trade-journal)                                                                                        | גבוהה         |
| `tradingview_paper_account_history.csv`                     | עמודות מאומתות; נוסח עמודת Action מהזיכרון                                                                                | בינונית       |
| `metatrader5_positions.csv`                                 | מאומת                                                                                                                     | גבוהה         |
| `metatrader5_deals.csv` / `metatrader4_account_history.csv` | מהזיכרון, תואם לאינדקסים בקוד של TradeNote                                                                                | בינונית       |
| `interactivebrokers_activity_statement.csv`                 | fixture (ibkr-k4-tax)                                                                                                     | גבוהה         |
| `interactivebrokers_flex_trades.csv`                        | שמות שדות מהקוד של TradeNote; הסדר תלוי ב-Query                                                                           | בינונית       |
| `thinkorswim_account_statement.csv`                         | קובץ ייצוא אמיתי מ-paperMoney                                                                                             | גבוהה         |

לפני שחרור כדאי לבדוק כל פורמט מול ייצוא אחד אמיתי משלך או מחבר בקבוצה.

---

## לפי פלטפורמה

### NinjaTrader 8

**ייצוא:** Control Center ← New ← Trade Performance ← בוחרים חשבון וטווח תאריכים ← Generate ← לשונית **Trades** ← קליק ימני ← Export. לקובץ המילויים: Control Center ← לשונית **Executions** ← קליק ימני ← Export.

- `Trades` = עסקה סגורה לשורה. `Executions` = מילוי לשורה.
- **`Profit` הוא נטו** (אחרי עמלה). כדי לקבל ברוטו: `Profit + Commission`.
- כסף בפורמט `$1,330.10` (עם מרכאות), ושלילי בסוגריים: `($13.74)`.
- תאריך: `10/14/2026 9:35:12 AM` (12 שעות, בלי אפס מוביל). **השעה היא שעון המחשב**, כלומר במחשב בישראל זו שעת ישראל.
- פסיק בסוף כל שורה, כלומר עמודה ריקה אחרונה.
- `Instrument` = `MNQ 12-26`. השורש הוא המילה הראשונה.
- גרסאות ישנות בלי `Clearing Fee`/`Exchange Fee`/`IP Fee`/`NFA Fee`. בממשק בצרפתית או בגרמנית הכותרות מתורגמות (`Compte`, `Prix d'entrée`...).
- `ETD = MFE - Profit`. `Position` אחרי מילוי: `2 L`, `1 S`, או `-` כשאין פוזיציה.

### Tradovate

**ייצוא:** Account ← בוחרים חשבון ← **Performance** (עסקאות מוצמדות) או **Orders** (פקודות) ← טווח תאריכים ← Go ← Download CSV.

- `Performance`: כל שורה היא זוג מילויים קנייה/מכירה. בשורט `soldTimestamp` מוקדם מ-`boughtTimestamp`. **`pnl` הוא ברוטו**, בלי עמלות. שלילי: `$(12.50)`.
- יציאה חלקית יוצרת שורות עם אותו `sellFillId` (או `buyFillId`).
- `Orders`: 26 עמודות. ערכים עם **רווח מוביל**: `" Buy"`, `" Filled"`, `" Market"`, ולכן צריך `trim()`. סטטוס ביטול: `Canceled` (L אחת).
- להשתמש ב-`Filled Qty` ו-`Avg Fill Price`, ולסנן `Status == Filled`.
- תאריך: `MM/DD/YYYY HH:mm:ss` בשעון החשבון.

### Rithmic R|Trader Pro

**ייצוא פקודות:** Recent Orders או Order History ← בוחרים חשבון ותאריך (**יום אחד לכל ייצוא**) ← קליק ימני על כותרות **Completed Orders** ← Add/Remove Columns. חובה: `Account`, `Status`, `Buy/Sell`, `Symbol`, `Qty Filled`, `Avg Fill Price`, `Order Number`, `Create Time`, `Update Time`. ואז Export ל-CSV.
**ייצוא ביצועים:** Trade Performance ← Export.

- קובץ הפקודות מתחיל בשורה `Completed Orders`. צריך לדלג עליה (ואולי גם על אזור Working Orders מעליה).
- **סדר העמודות תלוי במשתמש**, ולכן צריך למפות לפי שם.
- ייתכן שעמודות הזמן יגיעו עם סיומת אזור זמן. לכן כדאי להתאים לפי `startsWith("Update Time")` (כך עושה TradeNote).
- `Buy/Sell` = `B` / `S`. סטטוס ביטול: `Cancelled` (שתי L).
- קובץ הביצועים הוא **היררכי**: שורת חשבון, שורת סימול, כותרת, עסקאות, ושוב שורת סימול לכל חוזה. **אין בו עמודת סימול**: הסימול מגיע מהשורה שמעל כל בלוק. `Trade P&L` הוא ברוטו.
- במבנה החדש (מאמצע 2026) הקובץ נפתח בשורת סיכום `Account,Trade P&L,Commission & Fees`. שורות החשבון והסימול כוללות סכומים, ובכל עסקה יש עמודת `Trade Date` (`20261014`) לפני `Entry Order Number`. קובץ לדוגמה: `rithmic_rtraderpro_performance_2026.csv`.
- ב-Completed Orders, `Commission Fill Rate` היא עמלה **לחוזה**, לא סכום. עמלת השורה = `Commission Fill Rate × Qty Filled`.

### TopstepX

**ייצוא:** בוחרים חשבון (למעלה משמאל) ← חלונית **Trades** (לא Orders) ← Export (בפינה הימנית התחתונה) ← טווח תאריכים. אם הקובץ ריק, להרחיב את הטווח ביום לכל צד.

- עסקה לשורה. יציאה חלקית = כמה שורות.
- `Type` = `Long`/`Short`, `PnL` ברוטו, `Fees` בנפרד.
- **הזמנים בפורמט ISO 8601 עם offset**, למשל `2026-10-14T13:35:12+00:00`. TradeNote מתאר אותם כ-UTC, ו-Deltalytix משתמש ב-offset של ניו יורק. בכל מקרה צריך פרסר שמכבד את ה-offset.
- ייתכן שבייצוא חדש יופיעו עמודות נוספות, כמו `TradeDuration` או `Commissions`. ממפים לפי שם.

### TradingView (Paper Trading)

**ייצוא:** בתחתית הגרף ← Paper Trading ← לשונית **History** (נקראת גם Order History) ← אייקון הגדרות העמודות, להפעיל את **כולן** ← אייקון ההורדה ← Download. אפשר לייצא גם **Account History**.

- פקודה לשורה, כולל Stop/Target שבוטלו. מסננים `Status == Filled` ומצמידים ב-FIFO.
- `Symbol` עם בורסה: `CME_MINI:MNQ1!`, `NASDAQ:AAPL`.
- הקובץ מסודר **מהחדש לישן**.
- תאריך: `YYYY-MM-DD HH:mm:ss` לפי אזור הזמן של הגרף.
- `Account History` נותן P&L ממומש לכל סגירה, טוב לבדיקה צולבת.
- בחשבון אמיתי דרך ברוקר המבנה תלוי בברוקר.

### MetaTrader 5 ו-MetaTrader 4

**MT5:** Toolbox (Ctrl+T) ← History ← קליק ימני ← **Positions** ← בוחרים תקופה ← קליק ימני ← **Report** ← Open XML (Excel) או HTML.
**MT4:** Terminal ← Account History ← קליק ימני ← All History ← **Save as Detailed Report** (HTML).

- **אין ייצוא CSV מובנה.** ה-CSV כאן הוא הטבלה כפי שהיא נראית אחרי "שמירה בשם CSV" מ-Excel. באפליקציה כדאי לתמוך בייבוא של xlsx/html ישירות.
- דוח MT5 מכיל כמה טבלאות: Positions, Orders, Deals ו-Summary. ב-Positions **יש שתי עמודות `Time` ושתי עמודות `Price`** (פתיחה וסגירה), ולכן צריך לקרוא לפי אינדקס.
- `Profit` לא כולל `Commission` ו-`Swap`. נטו = סכום שלושתם.
- ב-Deals: `Direction` = `in`/`out`, ויש שורות `balance` להפקדות. ב-MT4 הסימול באותיות קטנות (`eurusd`), ובדוח ה-HTML מפריד האלפים הוא רווח (`10 000.00`).
- תאריך: `2026.10.14 16:35:12` **בשעון השרת של הברוקר** (לרוב GMT+2/+3).

### Interactive Brokers

**Activity Statement:** Portal ← Performance & Reports ← Statements ← Activity ← Period ← Format: **CSV** ← Run.
**Flex Query** (מומלץ לייבוא שוטף): Performance & Reports ← Flex Queries ← Trade Confirmation ← + ← Section: Executions ← לבחור שדות ← Format CSV, Include column headers: Yes ← Date Format `yyyyMMdd`, Time `HHmmss`, Separator `;` ← Save ← Run.

- ה-Activity Statement הוא **קובץ רב-חלקים**: עמודה 0 היא שם החלק (`Trades`, `Statement`...), ועמודה 1 היא סוג השורה (`Header`/`Data`/`SubTotal`/`Total`). לוקחים רק `Trades,Data,Order`.
- `Date/Time` = `"2026-10-14, 09:41:03"`, עם פסיק בתוך המרכאות.
- סימנים: קנייה = כמות חיובית ו-Proceeds שלילי. `Comm/Fee` שלילי. `Realized P/L` כבר כולל עמלה.
- `Code`: `O` = פתיחה, `C` = סגירה (יכולים להופיע יחד, למשל `C;P`).
- Flex: כל הערכים במרכאות. `Date/Time` = `20261014;094103`. סדר העמודות תלוי בשדות שנבחרו ב-Query.

### thinkorswim (Schwab)

**ייצוא:** באפליקציית הדסקטופ ← Monitor ← **Account Statement** ← טווח ימים ← תפריט Actions (שלושת הפסים, מימין למעלה) ← **Export to File**.

- **קובץ רב-חלקים:** `Cash Balance`, `Futures Statements`, `Account Order History`, `Account Trade History`, `Equities`/`Options`/`Futures` (אופציונליים), `Profits and Losses`, `Account Summary`. מאתרים כל חלק לפי שורת הכותרת שלו, עד השורה הריקה.
- `Account Trade History` מתחיל ב**עמודה ריקה**, ומסודר **מהחדש לישן**.
- **שנה בשתי ספרות:** `10/14/26 09:41:03`.
- `Qty` עם סימן: `+100`/`-50`. `Pos Effect` = `TO OPEN`/`TO CLOSE`.
- העמלות לא נמצאות ב-Trade History אלא ב-`Cash Balance` (`Misc Fees`, `Commissions & Fees`). TradeNote מצמיד ביניהם לפי זמן, וציין שלפעמים יש הפרש של 1-2 שניות.
- הקובץ מתחיל ב-BOM (`﻿`). בחשבון paperMoney יש שורת הסבר לפני הכותרת.

---

## איך Sniper Journal מייבא את הקבצים האלה

הרצתי את כל 16 הקבצים דרך `importTradesFromCsv` מהקוד של האפליקציה (הגרסה שב-GitHub, commit `e324ce5`), בלי למפות עמודות ידנית.

| קובץ                                        | זוהה כ-             | עסקאות | P&L נטו | תקין?                    |
| ------------------------------------------- | ------------------- | ------ | ------- | ------------------------ |
| `ninjatrader8_trades.csv`                   | NinjaTrader 8       | 4      | 87.56   | ✅                       |
| `ninjatrader8_executions.csv`               | NinjaTrader 8       | 3      | 87.56   | ✅                       |
| `tradovate_performance.csv`                 | Tradovate           | 3      | 95.00   | ✅ (אין עמלות בקובץ)     |
| `tradovate_orders.csv`                      | Tradovate           | 3      | 95.00   | ✅ (אין עמלות בקובץ)     |
| `rithmic_rtraderpro_orders.csv`             | Rithmic             | 3      | 95.00   | ⚠️ עמלה לא נקראה         |
| `rithmic_rtraderpro_performance.csv`        | Rithmic             | **0**  | —       | ❌                       |
| `rithmic_rtraderpro_performance_2026.csv`   | Rithmic             | **0**  | —       | ❌                       |
| `topstepx_trades.csv`                       | TopstepX            | 4      | 87.56   | ✅                       |
| `tradingview_paper_history.csv`             | TradingView         | 3      | 95.00   | ✅                       |
| `tradingview_paper_account_history.csv`     | —                   | 0      | —       | צפוי (זה לא קובץ עסקאות) |
| `metatrader5_positions.csv`                 | MetaTrader          | 3      | 142.95  | ✅                       |
| `metatrader5_deals.csv`                     | MetaTrader          | 3      | 142.95  | ✅                       |
| `metatrader4_account_history.csv`           | MetaTrader          | 3      | 142.95  | ✅                       |
| `interactivebrokers_activity_statement.csv` | Interactive Brokers | 2      | 248.50  | ✅                       |
| `interactivebrokers_flex_trades.csv`        | **לא זוהה**         | 2      | 248.50  | ✅ (רק השם חסר)          |
| `thinkorswim_account_statement.csv`         | Thinkorswim         | 2      | 252.50  | ⚠️ עמלות לא נקראו        |

הפרש במספר העסקאות (3 מול 4) נובע מכך שהאפליקציה מאחדת יציאה חלקית לעסקה אחת כשהיא מרכיבה עסקאות ממילויים. זה תקין.

### מה מצאתי

1. **באג: דוח Trade Performance של Rithmic לא נטען** (בשני המבנים). האפליקציה מוצאת את שורת הכותרת, אבל אין בה עמודת סימול, כי ב-Rithmic הסימול נמצא בשורה נפרדת מעל כל בלוק. התוצאה היא שגיאת "No symbol column found". ההצעה בשגיאה, להקליד סימול אחד לכל השורות, נותנת תוצאה שגויה כשיש בקובץ יותר מחוזה אחד. הבדיקה הקיימת (`tests/platform-exports.ts`) עוברת, כי הקובץ שבה כבר "שטוח" עם עמודות `AccountNumber` ו-`Instrument`. אלה השמות ש-Deltalytix **מייצר** אחרי העיבוד שלו, והם לא מופיעים בקובץ שמורידים מ-Rithmic.
2. **Rithmic Completed Orders: העמלה לא נקראת.** העמודה `Commission Fill Rate` (עמלה לחוזה) לא מוכרת, ולכן ה-P&L נטו גבוה מהאמת. בדוגמה: 95.00 במקום 87.56.
3. **thinkorswim: העמלות לא נקראות.** הן נמצאות בחלק `Cash Balance` (`Misc Fees`, `Commissions & Fees`), והאפליקציה קוראת רק את `Account Trade History`. הפער בדוגמה: 1.03$.
4. **Tradovate: אין עמלות בקובץ בכלל**, לא ב-Performance ולא ב-Orders. זו לא תקלה של האפליקציה, אבל המשתמש לא מקבל על זה הודעה, וה-P&L שהוא רואה הוא ברוטו.
5. **IBKR Trade Confirmation Flex לא מזוהה בשם.** העסקאות נטענות נכון, אבל הזיהוי מחפש `IBCommission` או `TradePrice` (שמות של Activity Flex). ב-Trade Confirmation Flex, לפי TradeNote, השמות הם `Price` ו-`Commission`. זה קוסמטי, ורמת הוודאות בינונית.
6. **TradingView Account History** נותן שגיאת "No symbol column found". הודעה כמו "זה Account History, יש לייצא Order History" הייתה עוזרת יותר.

## המלצות למנגנון הייבוא

**1. זיהוי פלטפורמה אוטומטי לפי כותרות:**

| אם מופיעות העמודות                                                     | הפלטפורמה                   |
| ---------------------------------------------------------------------- | --------------------------- |
| `Market pos.` + `Entry name` + `Cum. net profit`                       | NinjaTrader Trades          |
| `E/X` + `Position` + `Connection`                                      | NinjaTrader Executions      |
| `buyFillId` + `boughtTimestamp`                                        | Tradovate Performance       |
| `orderId` + `B/S` + `Fill Time`                                        | Tradovate Orders            |
| שורה `Completed Orders` / `Qty Filled` + `Avg Fill Price` + `Buy/Sell` | Rithmic Orders              |
| `Entry Order Number` + `Trade Life Span`                               | Rithmic Performance         |
| `ContractName` + `EnteredAt` + `ExitedAt`                              | TopstepX                    |
| `Placing Time` + `Closing Time` + `Fill Price`                         | TradingView History         |
| `Realized P&L (value)` + `Balance Before`                              | TradingView Account History |
| `Position` + `S / L` + `T / P` + `Swap`                                | MT5 Positions               |
| `Deal` + `Direction` + `Balance`                                       | MT5 Deals                   |
| `Ticket` + `Item` + `Taxes`                                            | MT4                         |
| שורה שמתחילה ב-`Trades,Header,DataDiscriminator`                       | IBKR Activity               |
| `ClientAccountID` + `AssetClass` + `Buy/Sell`                          | IBKR Flex                   |
| שורה `Account Trade History` + `Pos Effect`                            | thinkorswim                 |

**2. מיפוי לפי שם עמודה, לא לפי מיקום**, ותמיד `trim()` על כותרות וערכים (חוץ מ-MT5 Positions, שבו יש כותרות כפולות).

**3. פרסור כסף אחד לכולם:** להוריד `$` ו-`,`, ולהתייחס כשלילי ל-`(x)`, ל-`$(x)` ול-`-x`.

**4. אזורי זמן:** NinjaTrader משתמש בשעון המחשב, Tradovate ו-Rithmic בהגדרת החשבון, TopstepX ב-UTC, MT בשעון השרת, ו-TradingView באזור הזמן של הגרף. כדאי לשמור הכול ב-UTC ולבקש מהמשתמש לאשר את אזור הזמן בזמן הייבוא. זה חשוב במיוחד אם היומן מחשב סשנים (אסיה/לונדון/ניו יורק) או NY Midnight Open.

**5. מילויים מול עסקאות:** קבצי מילויים (NT Executions, Tradovate Orders, Rithmic, TradingView, thinkorswim, IBKR) דורשים הצמדת FIFO לפי סימול, ו-`verify_samples.py` מראה איך. קבצים שכבר מוצמדים (NT Trades, Tradovate Performance, Rithmic Performance, TopstepX, MT5 Positions) מפצלים יציאה חלקית לכמה שורות. אם רוצים "עסקה אחת", מאחדים לפי זמן כניסה וחוזה.

**6. שווי נקודה לחישוב P&L מקבצי מילויים:** MNQ = 2$, MES = 5$, NQ = 20$, ES = 50$, MGC = 10$, GC = 100$, MCL = 100$, CL = 1,000$. צריך טבלה כזו באפליקציה.

**7. ברוטו מול נטו:** ב-NT, `Profit` הוא נטו. ב-IBKR, `Realized P/L` הוא נטו. בכל השאר ה-P&L ברוטו והעמלה בעמודה נפרדת.

**8. מניעת כפילויות בייבוא חוזר:** מפתח ייחודי לפי ID מהקובץ (`ID`, `buyFillId`/`sellFillId`, `Order Number`, `Id`, `Deal`, `TradeID`). כשאין ID (thinkorswim), משתמשים בשילוב של זמן, סימול, כמות ומחיר.

**9. קידוד וסוף שורה:** תוכנות דסקטופ ב-Windows שומרות `\r\n`, ולפעמים עם BOM. הקבצים כאן משקפים את זה, ולכן ה-parser צריך לעמוד בשניהם.

---

## מקורות

- [TradeNote, מייבאים ל-NinjaTrader/Tradovate/Rithmic/TopstepX/IBKR/thinkorswim/MT5](https://github.com/Eleven-Trading/TradeNote) (`src/utils/brokers.js`, `brokers/README.md`, `brokers/conversionScripts.md`)
- [Deltalytix, קבצי דוגמה ומייבאים](https://github.com/hugodemenez/deltalytix) (`public/samples/import`)
- [chartjot, fixtures של NinjaTrader](https://github.com/rbruhn/chartjot), [issue #44](https://github.com/rbruhn/chartjot/issues/44)
- [tilt-check, fixtures של Tradovate](https://github.com/ssap-pa/tilt-check/pull/4)
- [trade-journal, מייבא TradingView Paper](https://github.com/Wallisgareth004/trade-journal)
- [ibkr-k4-tax, פורמט Activity Statement](https://github.com/Mohammad-Rahmati/ibkr-k4-tax)
- [thinkorswim Statement Parser, קובץ ייצוא לדוגמה](https://github.com/ClaytonDuffin/thinkorswim-Trading-Statement-Parser-)
- [TradeZella: ייצוא מ-TopstepX](https://help.tradezella.com/en/articles/9557681-topstepx-how-to-import-trades-from-topstepx-into-tradezella-using-the-file-upload-method), [מ-Rithmic](https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method), [מ-TradingView](https://help.tradezella.com/en/articles/6992227-tradingview-how-to-import-trades-from-tradingview-into-tradezella)
- [TradeZella: ייצוא מ-Tradovate (רשימת 26 העמודות של Orders)](https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method)
- [Deltalytix: מבנה Rithmic Performance החדש](https://github.com/hugodemenez/deltalytix) (`lib/rithmic-performance-import.ts`, `content/updates/en/rithmic-performance-trade-date-import.mdx`)
- [Tradesyncer: ייבוא ידני](https://help.tradesyncer.com/en/articles/16112501-how-to-manually-import-trades)
- [TradeDeck: Tradovate Orders ו-FIFO](https://www.tradedeck.io/blog/import-tradovate-orders-fifo)
- [TradingDiary Pro: מבנה ייצוא thinkorswim](https://webhelp.tradingdiarypro.com/tos_import.htm)
- [MT5 Trading Journal: ייצוא ועמודות](https://calculatorai.app/blog/metatrader-5-trading-journal)
- [Edgewonk: TopstepX](https://edgewonk.zendesk.com/hc/en-us/articles/18899396781842-Topstep-X)
