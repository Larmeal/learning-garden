import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// A subject is one thing to learn (Spark, SQL, ...). Add src/content/subjects/<id>.json to plant a new one.
// The id is part of every URL and saved progress key, so never rename it. `category` only groups subjects on the
// home page (it is not a folder, for the same reason); `order` sorts subjects inside a category and the categories
// themselves (a category sits where its first subject sits).
const subjects = defineCollection({
  loader: glob({ base: './src/content/subjects', pattern: '*.json' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    // optional short lines under the description (how the subject was checked, what was not run), shown as a list
    facts: z.array(z.string()).optional(),
    category: z.string().default('อื่นๆ'),
    order: z.number().default(100),
    accent: z.string().default('#C93F0A'),
    accentDark: z.string().default('#FF8A4C'),
    phases: z.array(z.object({ id: z.string(), title: z.string(), check: z.string() })),
    // English text of the subject. name, tagline and category are enough to list it on the English home page;
    // description and phases fall back to the Thai ones until they are translated.
    en: z
      .object({
        name: z.string(),
        tagline: z.string(),
        category: z.string(),
        description: z.string().optional(),
        facts: z.array(z.string()).optional(),
        phases: z.array(z.object({ id: z.string(), title: z.string(), check: z.string() })).optional(),
      })
      .optional(),
  }),
});

// A lesson is one page or a folder of pages:
//   lessons/<subject>/<slug>.mdx             a lesson that is a single page
//   lessons/<subject>/<slug>/index.mdx       the main page of a lesson that has sub-pages
//   lessons/<subject>/<slug>/<child>.mdx     a sub-page: a deep dive, or the quiz (kind: quiz)
// Main pages need order, phase and level. Sub-pages only need order (their place inside the lesson).
// `requires` lists slugs of lessons in the same subject and is read from main pages only.
const lessonSchema = z.object({
  title: z.string(),
  summary: z.string(),
  // optional short lines under the summary: how the lesson was checked (ran, source, book) and what was not run, shown as a list
  facts: z.array(z.string()).optional(),
  order: z.number(),
  phase: z.string().optional(),
  level: z.number().min(1).max(5).optional(),
  kind: z.enum(['deep', 'quiz']).default('deep'),
  stage: z.enum(['seed', 'sprout', 'evergreen']).default('seed'),
  // "steps" lessons are written with <Step> blocks and can be played one card at a time; "read" is a plain long page.
  format: z.enum(['steps', 'read']).default('read'),
  requires: z.array(z.string()).default([]),
  updated: z.coerce.date().optional(),
});

// English lessons mirror the Thai ones: lessons-en/<subject>/<slug>/index.mdx has the same slug as lessons/<subject>/<slug>/index.mdx,
// so progress keys, requires and URLs line up. A subject with no folder here is Thai only.
const lessons = defineCollection({ loader: glob({ base: './src/content/lessons', pattern: '**/*.{md,mdx}' }), schema: lessonSchema });
const lessonsEn = defineCollection({ loader: glob({ base: './src/content/lessons-en', pattern: '**/*.{md,mdx}' }), schema: lessonSchema });

export const collections = { subjects, lessons, lessonsEn };
