import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import oldWebview, { hexChannels, withoutColorMix } from '../scripts/postcss-old-webview.mjs';

const run = async (css: string) => (await postcss([oldWebview()]).process(css, { from: undefined })).css;
const squash = (css: string) => css.replace(/\s+/g, ' ').trim();

describe('colour channels', () => {
  it('reads #rgb, #rrggbb and ignores alpha and anything else', () => {
    expect(hexChannels('#34d399')).toBe('52 211 153');
    expect(hexChannels(' #000 ')).toBe('0 0 0');
    expect(hexChannels('#ffffff80')).toBe('255 255 255');
    expect(hexChannels('var(--x)')).toBeNull();
    expect(hexChannels('oklch(0.7 0.1 150)')).toBeNull();
  });

  it('writes "colour at N% over transparent" as the same tint in rgb()', () => {
    const known = new Set(['profit']);
    expect(withoutColorMix('color-mix(in oklab, var(--profit) 15%, transparent)', known)).toBe('rgb(var(--profit-rgb) / 15%)');
    expect(withoutColorMix('color-mix(in srgb, #000 60%, transparent)', known)).toBe('rgb(0 0 0 / 60%)');
    expect(withoutColorMix('drop-shadow(0 0 6px color-mix(in srgb, var(--profit) 55%, transparent))', known)).toBe(
      'drop-shadow(0 0 6px rgb(var(--profit-rgb) / 55%))',
    );
  });

  it('leaves alone what it cannot write exactly', () => {
    const known = new Set(['profit']);
    expect(withoutColorMix('color-mix(in oklab, var(--unknown) 15%, transparent)', known)).toBeNull();
    expect(withoutColorMix('color-mix(in oklab, currentcolor 50%, transparent)', known)).toBeNull();
    expect(
      withoutColorMix('color-mix(in oklab, color-mix(in oklab, var(--profit) 40%, transparent) var(--tw-shadow-alpha), transparent)', known),
    ).toBeNull();
  });
});

describe('the stylesheet, as Tailwind writes it', () => {
  it('gives each colour custom property its channels, in every theme', async () => {
    const out = squash(await run(':root { --profit: #34d399; --x: var(--y); } :root.light { --profit: #056e4c; }'));
    expect(out).toContain('--profit: #34d399; --profit-rgb: 52 211 153;');
    expect(out).toContain('--profit: #056e4c; --profit-rgb: 5 110 76;');
    expect(out).not.toContain('--x-rgb');
  });

  it('turns the solid fallback of a tint into the tint itself; the color-mix() rule stays for newer engines', async () => {
    const out = squash(
      await run(`:root { --profit: #34d399; }
        .bg-profit\\/15 {
          background-color: var(--profit);
          @supports (color: color-mix(in lab, red, red)) {
            background-color: color-mix(in oklab, var(--profit) 15%, transparent);
          }
        }`),
    );
    expect(out).toContain('.bg-profit\\/15 { background-color: rgb(var(--profit-rgb) / 15%);');
    expect(out).toContain('@supports (color: color-mix(in lab, red, red)) { background-color: color-mix(in oklab, var(--profit) 15%, transparent); }');
  });

  it('does the same in the flattened shape of a production build', async () => {
    const out = squash(
      await run(`:root { --profit: #34d399; }
        .bg-profit\\/15 { background-color: var(--profit); }
        @supports (color: color-mix(in lab, red, red)) { .bg-profit\\/15 { background-color: color-mix(in oklab, var(--profit) 15%, transparent); } }`),
    );
    expect(out).toContain('.bg-profit\\/15 { background-color: rgb(var(--profit-rgb) / 15%); } @supports');
    expect(out).toContain('{ .bg-profit\\/15 { background-color: color-mix(in oklab, var(--profit) 15%, transparent); } }');
  });

  it('adds a fallback rule when a flattened block has none just before it', async () => {
    const out = squash(
      await run(`:root { --loss: #ff6879; }
        @supports (color: color-mix(in lab, red, red)) { .x { color: color-mix(in oklab, var(--loss) 50%, transparent); } }`),
    );
    expect(out).toContain('.x { color: rgb(var(--loss-rgb) / 50%); } @supports');
  });

  it('works the same for hover and other variants nested deeper', async () => {
    const out = squash(
      await run(`:root { --loss: #ff6879; }
        .hover\\:bg-loss\\/20 { &:hover { @media (hover: hover) {
          background-color: var(--loss);
          @supports (color: color-mix(in lab, red, red)) { background-color: color-mix(in oklab, var(--loss) 20%, transparent); }
        } } }`),
    );
    expect(out).toContain('background-color: rgb(var(--loss-rgb) / 20%);');
  });

  it('writes a mix that is itself the fallback (shadow colours) plainly', async () => {
    const out = squash(await run('.shadow-black\\/40 { --tw-shadow-color: color-mix(in srgb, #000 40%, transparent); }'));
    expect(out).toBe('.shadow-black\\/40 { --tw-shadow-color: rgb(0 0 0 / 40%); }');
  });

  it('adds a fallback before a color-mix() written without one', async () => {
    const out = squash(await run(':root { --accent: #818cf8; } ::selection { background: color-mix(in srgb, var(--accent) 35%, transparent); }'));
    expect(out).toContain('::selection { background: rgb(var(--accent-rgb) / 35%); background: color-mix(in srgb, var(--accent) 35%, transparent); }');
  });

  it('gives 100dvh a 100vh fallback for engines without dvh, in its own @supports block', async () => {
    const out = squash(await run('.h-dvh { height: 100dvh; }'));
    expect(out).toBe('.h-dvh { height: 100dvh; @supports not (height: 1dvh) { height: 100vh } }');
  });

  it('changes nothing else', async () => {
    const css = '.p-4 { padding: 1rem; } .text-fg { color: var(--fg); } @media (min-width: 48rem) { .md\\:flex { display: flex; } }';
    expect(await run(css)).toBe(css);
  });
});
