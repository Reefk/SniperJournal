import { breakableAmount, numberAndUnit, wholeAndCents } from '@/lib/format';

/**
 * An amount in a narrow cell (a Calendar day, a Reports heatmap hour), on two
 * lines where the cell is too narrow for one: before a unit the language
 * writes after the number ("тыс. $"), or else before the cents ("+$740" over
 * ".31"). On a phone a unit always has a line of its own.
 */
export function CellAmount({ text, phone = false }: { text: string; phone?: boolean }) {
  const unit = numberAndUnit(text);
  if (unit && phone) {
    return (
      <>
        {unit[0]}
        <br />
        {unit[1]}
      </>
    );
  }
  if (unit) return breakableAmount(text);
  const cents = wholeAndCents(text);
  if (!cents) return text;
  return (
    <>
      {cents[0]}
      <wbr />
      {cents[1]}
    </>
  );
}
