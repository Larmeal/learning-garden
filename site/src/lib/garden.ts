import { getCollection, type CollectionEntry } from 'astro:content';
import { langPrefix, type Lang } from '../i18n';

// Thai and English lessons have the same shape and the same ids (see content.config.ts).
export type Lesson = CollectionEntry<'lessons'> | CollectionEntry<'lessonsEn'>;
export type Subject = CollectionEntry<'subjects'>;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// "<subject>/<slug>/index" and "<subject>/<slug>" are the same page.
export const pageKey = (entryId: string) => entryId.replace(/\/index$/, '');
export const subjectOf = (entryId: string) => entryId.split('/')[0];
/** "catalyst" for a main page, "catalyst/aqe" for a sub-page. */
export const slugOf = (entryId: string) => pageKey(entryId).split('/').slice(1).join('/');
export const isChild = (entryId: string) => slugOf(entryId).includes('/');
export const parentSlug = (entryId: string) => slugOf(entryId).split('/')[0];
export const homeHref = (lang: Lang = 'th') => `${base}${langPrefix(lang)}/`;
export const subjectHref = (subject: string, lang: Lang = 'th') => `${base}${langPrefix(lang)}/${subject}/`;
export const lessonHref = (entryId: string, lang: Lang = 'th') => `${base}${langPrefix(lang)}/${subjectOf(entryId)}/${slugOf(entryId)}/`;

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

export const pageInfo = (p: Lesson, main: Lesson, lang: Lang = 'th'): PageInfo => ({
  id: pageKey(p.id),
  title: p.data.title,
  href: lessonHref(p.id, lang),
  kind: p === main ? 'main' : p.data.kind,
});

const lessonsIn = async (subject: string, lang: Lang): Promise<Lesson[]> => {
  const inSubject = ({ id }: { id: string }) => subjectOf(id) === subject;
  return lang === 'en' ? getCollection('lessonsEn', inSubject) : getCollection('lessons', inSubject);
};

const idsCache: Partial<Record<Lang, Promise<Set<string>>>> = {};
/** Whether a lesson page exists in a language (getEntry would log a warning for a page that is missing). */
export const hasPage = async (entryId: string, lang: Lang) => {
  idsCache[lang] ??= (lang === 'en' ? getCollection('lessonsEn') : getCollection('lessons')).then((all) => new Set(all.map((l) => l.id)));
  return (await idsCache[lang]!).has(entryId);
};

/** Whether a subject has any lesson in this language. Thai is the original language of every subject. */
export const hasLang = async (subject: string, lang: Lang) => lang === 'th' || (await lessonsIn(subject, lang)).length > 0;

/** Lessons of one subject in reading order, each with its sub-pages. Fails the build on a broken `requires` or a sub-page without a main page. */
export async function groupsOf(subject: string, lang: Lang = 'th'): Promise<Group[]> {
  const all = await lessonsIn(subject, lang);
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
export async function lessonsOf(subject: string, lang: Lang = 'th'): Promise<Lesson[]> {
  return (await groupsOf(subject, lang)).map((g) => g.main);
}

/** Static paths of the lesson pages in one language. */
export async function lessonPaths(lang: Lang) {
  const lessons = lang === 'en' ? await getCollection('lessonsEn') : await getCollection('lessons');
  return lessons.map((l) => ({ params: { subject: subjectOf(l.id), lesson: slugOf(l.id) }, props: { lesson: l as Lesson } }));
}

export interface SubjectText {
  name: string;
  tagline: string;
  description: string;
  category: string;
  phases: { id: string; title: string; check: string }[];
}

/** Name, tagline and phases of a subject in one language; whatever is not translated yet stays Thai. */
export function subjectText(s: Subject, lang: Lang): SubjectText {
  const th = { name: s.data.name, tagline: s.data.tagline, description: s.data.description, category: s.data.category, phases: s.data.phases };
  const en = s.data.en;
  if (lang !== 'en' || !en) return th;
  return {
    name: en.name,
    tagline: en.tagline,
    category: en.category,
    description: en.description ?? th.description,
    phases: s.data.phases.map((p) => ({ ...p, ...en.phases?.find((x) => x.id === p.id) })),
  };
}

export const pad = (n: number) => String(n).padStart(2, '0');
