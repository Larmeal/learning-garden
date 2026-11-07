---
name: audit
description: Work through the owner's notes left on the website with the Notes app of the dev toolbar (.audit/comments.json). Use when the owner says to audit the site, read the notes, or fix what they marked.
---

# Audit: act on the owner's notes

The owner points at a part of a page in `astro dev` (the speech-bubble "Notes" app), picks a category and writes what is wrong.
Each note is saved in `.audit/comments.json` at the repo root. The file is git-ignored on purpose (the repo is public), so never
copy a note into a commit message, a changelog line or a file that is tracked, except as a short paraphrase of the problem.

## 1. Read

Read `.audit/comments.json`. If it is missing or has no `open` notes, say so and stop.

```
{ version: 1, comments: [{
  id, path, createdAt, status: "open" | "resolved",
  category: "fact" | "wording" | "layout" | "lab" | "idea",
  text,
  target: { kind: "text" | "element", quote, prefix, suffix, tag, selector, label, snippet, component, astroFile, astroLoc },
  context: { viewport: {w, h}, theme, lang, view, step, sourceFile },
  replies: [{ by: "you" | "claude", at, text }]
}] }
```

Work on notes with `status: "open"`. A note whose last reply is from `you` is a follow-up question: answer it first.

## 2. Find the place

- `path` is the page URL path. `context.sourceFile` is the lesson `.mdx` when the page is a lesson (it can be a Thai or an English file:
  look at `context.lang`).
- `target.quote` (with `prefix` and `suffix`) is the selected text: search the source for it. In MDX the text can be split by
  markup, so search a short unique part.
- `target.component` is the React file of a lab or island (for example `src/components/TopicMap.tsx`). For an element of an `.astro`
  page, `astroFile` is empty in this Astro version: use `selector`, `label` (`Component > tag.class`) and `snippet` to find it in
  `site/src/views/`, `site/src/components/` and `site/src/styles/global.css`.
- `context.viewport`, `theme`, `view` (steps or long) and `step` tell you how the owner saw it. For a layout note, reproduce it
  in that viewport and theme before changing anything (Playwright with the installed Chromium, against the dev server).

## 3. Decide by category

- `fact`: check the claim against the evidence of that subject (`subjects/<id>/docs/verified-findings.md`, the exercises, the
  source in the graph). Fix the lesson only when the claim is wrong, and keep the ran/source/author tags honest. If you cannot
  verify it, say what you checked and leave the note open with a question.
- `wording`: rewrite following CLAUDE.md (Thai keeps technical terms in English, capital letters in Thai headings, no em dash,
  book citations as section plus page).
- `layout`: fix the CSS or component. Check desktop and a 390px phone, light and dark.
- `lab`: read the lab component under `site/src/components/labs/<subject>/`. Run it in the browser before and after.
- `idea`: do not build it. Reply with what it would take and what you would suggest, and leave it open.

## 4. Change the site

- A lesson that exists in Thai and English: change both, or say in the reply which one is still behind. `npm run sync` (from
  `site/`) lists what is out of step.
- Do not rename a heading without searching the lessons for links to its old id (CLAUDE.md, "Links between lessons").
- Every mention of another lesson must be a link: `npm run check:refs` (from `site/`) must print 0 references that are not links (see CLAUDE.md, "Links between lessons").
- `npm run build` from `site/` must pass. Add a line to `CHANGELOG.md` for a change a reader can see.
- Do not commit or push unless the owner asks in that turn.

## 5. Answer in the file

For every note you handled, append to its `replies`:

```
{ "by": "claude", "at": "<ISO time>", "text": "what you found and what you changed, with file names" }
```

- Fixed and checked: set `status` to `"resolved"`. The owner can reopen it in the page.
- Not changed (unclear, cannot verify, an idea, needs a decision): keep `"open"` and ask the question in the reply.
- Keep the reply short and in the language of the note (the owner writes Thai).

Edit the file as a whole JSON document (parse, change, write back with 2-space indent and a final newline). Do not change `id`,
`createdAt`, `target` or `context`. The dev server re-reads the file when the owner's window gets focus, so the answers show up
in the page.

## 6. Report

Finish with a short list: note id and a few words of what it was, what you did, status. Mention the notes you left open and why.
