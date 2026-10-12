// PostCSS, after Tailwind: keeps the app readable in browser engines older
// than Tailwind 4 aims for (Chrome 111). Phones that haven't updated Android
// System WebView in a while still run them.
//
// 1. Tints. Tailwind writes "profit at 15%" as color-mix(), with the plain
//    colour as the fallback for engines without color-mix (before Chrome 111).
//    So there a 15% tint came out solid, and the text on it vanished. Here
//    each such fallback becomes the same tint in the old syntax, rgb(r g b /
//    15%), which is exactly what mixing a colour with transparent gives. A
//    colour given as a custom property (--profit: #34d399) gets its channels
//    as --profit-rgb next to it, so the tints follow the light and dark themes.
//
// 2. Screen height. 100dvh (Chrome 108) gets 100vh for engines that don't know
//    it; inside an app's WebView there is no address bar, so the two are the
//    same there. Without it the app was as tall as its content, and the tab
//    bar sat at the very bottom of the page. The fallback sits in its own
//    @supports block, so no minifier drops it as "overridden".
//
// Modern engines see no difference: they read the color-mix() and dvh rules
// as before. Tested in tests/postcss-old-webview.test.ts.

const MIX = /color-mix\(in [a-z-]+,\s*(var\(--([\w-]+)\)|#[0-9a-f]{3,8}|[a-z]+)\s+([\d.]+)%,\s*transparent\)/gi;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const VIEWPORT = /(\d)(dvh|svh|lvh)\b/;

/** "#34d399" -> "52 211 153", or null for anything that isn't a plain hex colour */
export function hexChannels(value) {
  const m = HEX.exec(value.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
}

/**
 * The value with every "colour at N% over transparent" written as rgb(... / N%).
 * Null when something in it can't be: a colour that isn't a known custom
 * property or a hex value (currentcolor, a mix inside a mix).
 */
export function withoutColorMix(value, known) {
  let ok = true;
  const out = value.replace(MIX, (whole, colour, name, percent) => {
    if (name) {
      if (!known.has(name)) ok = false;
      return `rgb(var(--${name}-rgb) / ${percent}%)`;
    }
    const channels = hexChannels(colour);
    if (!channels) ok = false;
    return `rgb(${channels} / ${percent}%)`;
  });
  return ok && !out.includes('color-mix(') ? out : null;
}

const isMixGuard = (node) => node?.type === 'atrule' && node.name === 'supports' && node.params.includes('color-mix');
const isOwnGuard = (node) => node?.type === 'atrule' && node.name === 'supports' && node.params.startsWith('not (');

export default function oldWebview() {
  return {
    postcssPlugin: 'old-webview',
    Once(root, { AtRule, Declaration, Rule }) {
      // channels for every colour custom property, beside it, in every theme
      const known = new Set();
      root.walkDecls(/^--/, (decl) => {
        const channels = hexChannels(decl.value);
        if (!channels || decl.prop.startsWith('--tw-')) return;
        known.add(decl.prop.slice(2));
        const prop = `${decl.prop}-rgb`;
        if (!decl.parent.some((n) => n.type === 'decl' && n.prop === prop)) decl.cloneAfter({ prop, value: channels });
      });

      // 1. tints. Tailwind hands over one of two shapes: nested while
      // developing (.x { a: solid; @supports (color-mix) { a: mix } }), and
      // flattened in a production build (.x { a: solid } @supports (color-mix)
      // { .x { a: mix } }). Either way the plain fallback is what an old
      // engine reads, so that is what becomes the tint.
      const mixes = [];
      root.walkDecls((decl) => {
        if (decl.value.includes('color-mix(')) mixes.push(decl);
      });
      for (const decl of mixes) {
        const fallback = withoutColorMix(decl.value, known);
        if (!fallback) continue;
        if (isMixGuard(decl.parent)) {
          // nested: the same property, before the block, in the same rule
          const block = decl.parent;
          let sibling = block.prev();
          while (sibling && !(sibling.type === 'decl' && sibling.prop === decl.prop)) sibling = sibling.prev();
          if (sibling) sibling.value = fallback;
          else block.before(decl.clone({ value: fallback }));
        } else if (decl.parent.type === 'rule' && isMixGuard(decl.parent.parent)) {
          // flattened: a rule with the same selector, just before the block
          const rule = decl.parent;
          const block = rule.parent;
          const prev = block.prev();
          const solid =
            prev?.type === 'rule' && prev.selector === rule.selector
              ? prev.nodes.find((n) => n.type === 'decl' && n.prop === decl.prop)
              : undefined;
          if (solid) solid.value = fallback;
          else block.before(new Rule({ selector: rule.selector, nodes: [decl.clone({ value: fallback })] }));
        } else if (decl.prop.startsWith('--')) {
          // a custom property is "valid" whatever it holds, so it can't fall back: write it plainly
          decl.value = fallback;
        } else {
          // written by hand without a fallback
          decl.cloneBefore({ value: fallback });
        }
      }

      // 2. screen height
      root.walkDecls((decl) => {
        const m = VIEWPORT.exec(decl.value);
        if (!m || isOwnGuard(decl.parent)) return;
        const guard = new AtRule({ name: 'supports', params: `not (${decl.prop}: 1${m[2]})` });
        guard.append(new Declaration({ prop: decl.prop, value: decl.value.replace(new RegExp(VIEWPORT.source, 'g'), '$1vh') }));
        decl.after(guard);
      });
    },
  };
}
oldWebview.postcss = true;
