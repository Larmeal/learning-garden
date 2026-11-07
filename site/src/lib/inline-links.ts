// Text that is not Markdown, such as the `q` and `why` of a <Question> or the title of a <Callout>, can still hold a link to another
// lesson, written the same way as in lesson text: [บทที่ 3](/data-quality/profiling/). The path starts at the root of the site and
// the GitHub Pages base path is put in front here, like MdLink.astro does for lesson text.
// tools/lesson-refs.mjs writes and checks these links.

export type InlinePart = string | { text: string; href: string };

const LINK = /\[([^\]\n]+)\]\((\/[^)\s]*)\)/g;
const base = () => import.meta.env.BASE_URL.replace(/\/$/, '');

export function splitLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ text: m[1], href: base() + m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// The same text without the link markup: what a button, an id or a stored key should use.
export const stripLinks = (text: string) => text.replace(LINK, '$1');
