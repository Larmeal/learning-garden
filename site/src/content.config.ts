import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// A subject is one thing to learn (Spark, SQL, ...). Add src/content/subjects/<id>.json to plant a new one.
const subjects = defineCollection({
  loader: glob({ base: './src/content/subjects', pattern: '*.json' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    accent: z.string().default('#C93F0A'),
    accentDark: z.string().default('#FF8A4C'),
    phases: z.array(z.object({ id: z.string(), title: z.string(), check: z.string() })),
  }),
});

// A lesson is one page or a folder of pages:
//   lessons/<subject>/<slug>.mdx             a lesson that is a single page
//   lessons/<subject>/<slug>/index.mdx       the main page of a lesson that has sub-pages
//   lessons/<subject>/<slug>/<child>.mdx     a sub-page: a deep dive, or the quiz (kind: quiz)
// Main pages need order, phase and level. Sub-pages only need order (their place inside the lesson).
// `requires` lists slugs of lessons in the same subject and is read from main pages only.
const lessons = defineCollection({
  loader: glob({ base: './src/content/lessons', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number(),
    phase: z.string().optional(),
    level: z.number().min(1).max(5).optional(),
    kind: z.enum(['deep', 'quiz']).default('deep'),
    stage: z.enum(['seed', 'sprout', 'evergreen']).default('seed'),
    // "steps" lessons are written with <Step> blocks and can be played one card at a time; "read" is a plain long page.
    format: z.enum(['steps', 'read']).default('read'),
    requires: z.array(z.string()).default([]),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { subjects, lessons };
