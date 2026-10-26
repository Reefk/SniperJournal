import { Fragment, type ReactNode } from 'react';

/**
 * A translated text with tags in it, "Open it with <b>Settings</b>.", each
 * tag's text drawn by its function in `tags`. Tags don't nest; a tag with
 * no function shows its text as it is.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode {
  const out: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/gs;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const draw = tags[match[1]];
    out.push(<Fragment key={out.length}>{draw ? draw(match[2]) : match[2]}</Fragment>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
