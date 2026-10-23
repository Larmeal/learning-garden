import { getCollection, type CollectionEntry } from 'astro:content';

export type Lesson = CollectionEntry<'lessons'>;
export type Subject = CollectionEntry<'subjects'>;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// "<subject>/<slug>/index" and "<subject>/<slug>" are the same page.
export const pageKey = (entryId: string) => entryId.replace(/\/index$/, '');
export const subjectOf = (entryId: string) => entryId.split('/')[0];
/** "catalyst" for a main page, "catalyst/aqe" for a sub-page. */
export const slugOf = (entryId: string) => pageKey(entryId).split('/').slice(1).join('/');
export const isChild = (entryId: string) => slugOf(entryId).includes('/');
export const parentSlug = (entryId: string) => slugOf(entryId).split('/')[0];
export const subjectHref = (subject: string) => `${base}/${subject}/`;
export const lessonHref = (entryId: string) => `${base}/${subjectOf(entryId)}/${slugOf(entryId)}/`;

/** A lesson: its main page plus any sub-pages, in reading order. */
export interface Group {
  main: Lesson;
  children: Lesson[];
  pages: Lesson[];
}

export type PageKind = 'main' | 'deep' | 'quiz';
export interface PageInfo {
  id: string; // progress key
  title: string;
  href: string;
  kind: PageKind;
}
export const KIND_LABEL: Record<PageKind, string> = { main: 'ภาพรวม', deep: 'ลงลึก', quiz: 'บททดสอบ' };

export const pageInfo = (p: Lesson, main: Lesson): PageInfo => ({
  id: pageKey(p.id),
  title: p.data.title,
  href: lessonHref(p.id),
  kind: p === main ? 'main' : p.data.kind,
});

/** Lessons of one subject in reading order, each with its sub-pages. Fails the build on a broken `requires` or a sub-page without a main page. */
export async function groupsOf(subject: string): Promise<Group[]> {
  const all = await getCollection('lessons', ({ id }) => subjectOf(id) === subject);
  const mains = all.filter((l) => !isChild(l.id));
  const slugs = new Set(mains.map((l) => slugOf(l.id)));

  for (const l of mains) {
    for (const f of ['phase', 'level'] as const) {
      if (l.data[f] === undefined) throw new Error(`${l.id}: main pages need "${f}" in the frontmatter`);
    }
    for (const r of l.data.requires) {
      if (!slugs.has(r)) throw new Error(`${l.id}: requires "${r}" but ${subject}/${r} does not exist`);
    }
  }
  for (const l of all.filter((x) => isChild(x.id))) {
    if (!slugs.has(parentSlug(l.id))) throw new Error(`${l.id}: sub-page has no main page ${subject}/${parentSlug(l.id)}/index.mdx`);
  }

  return mains
    .sort((a, b) => a.data.order - b.data.order)
    .map((main) => {
      const children = all.filter((l) => isChild(l.id) && parentSlug(l.id) === slugOf(main.id)).sort((a, b) => a.data.order - b.data.order);
      return { main, children, pages: [main, ...children] };
    });
}

/** Main pages only, in reading order. */
export async function lessonsOf(subject: string): Promise<Lesson[]> {
  return (await groupsOf(subject)).map((g) => g.main);
}

export const pad = (n: number) => String(n).padStart(2, '0');
