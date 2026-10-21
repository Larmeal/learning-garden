import { getCollection, type CollectionEntry } from 'astro:content';

export type Lesson = CollectionEntry<'lessons'>;
export type Subject = CollectionEntry<'subjects'>;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const subjectOf = (lessonId: string) => lessonId.split('/')[0];
export const slugOf = (lessonId: string) => lessonId.split('/').slice(1).join('/');
export const subjectHref = (subject: string) => `${base}/${subject}/`;
export const lessonHref = (lessonId: string) => `${base}/${subjectOf(lessonId)}/${slugOf(lessonId)}/`;

/** Lessons of one subject in reading order. Fails the build if a `requires` slug points nowhere. */
export async function lessonsOf(subject: string): Promise<Lesson[]> {
  const all = await getCollection('lessons', ({ id }) => subjectOf(id) === subject);
  const slugs = new Set(all.map((l) => slugOf(l.id)));
  for (const l of all) {
    for (const r of l.data.requires) {
      if (!slugs.has(r)) throw new Error(`${l.id}: requires "${r}" but ${subject}/${r} does not exist`);
    }
  }
  return all.sort((a, b) => a.data.order - b.data.order);
}

export const pad = (n: number) => String(n).padStart(2, '0');

export const STAGE_LABEL = { seed: 'เมล็ด', sprout: 'ต้นอ่อน', evergreen: 'โตเต็มที่' } as const;
