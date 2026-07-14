# How to Maintain Your Digital Garden

This site uses **Astro Content Collections** + **MDX**.

## 📂 Content Structure

All your content lives in `src/content/`:

```
src/content/
├── thoughts/       # Blog posts
├── lab/            # Projects / Experiments
└── garden/         # Knowledge Nodes
```

## 📝 How to Add Content

### 1. New Blog Post (Thought)
Create a new file in `src/content/thoughts/my-new-post.md`:

```markdown
---
title: 'My New Post'
description: 'A brief summary of what this is about.'
pubDate: 2025-12-20
tags: ['tag1', 'tag2']
---

Write your post here in Markdown!
```

### 2. New Lab Experiment (Interactive MDX)
Create a new file in `src/content/lab/project-name.mdx`:

**Note the `.mdx` extension!** This allows you to import components.

```mdx
---
title: 'Project Title'
description: 'What are you building?'
pubDate: 2025-12-20
status: 'prototype'
stack: ['React', 'Three.js']
---
import Callout from '../../components/mdx/Callout.astro';
import Button from '../../components/mdx/Button.astro';

## My Experiment

<Callout type="info">
  This is a custom alert component!
</Callout>

<Button href="https://github.com/..." icon="fa-github">View Code</Button>
```

### 3. New Garden Node
Create a new file in `src/content/garden/concept-name.md`:

```markdown
---
title: 'Concept Name'
description: 'Quick definition'
updatedDate: 2025-12-20
stage: 'seedling'
tags: ['learning', 'vr']
---
Notes go here...
```

## 🚀 Deployment (Cloudflare Pages)

Since your project is in a subdirectory (`between-binary`), use these settings in Cloudflare:

| Setting | Value |
| :--- | :--- |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Root Directory** | `between-binary` |

### Process:
1.  Commit your changes: `git add .` -> `git commit -m "New post"`
2.  Push: `git push`
3.  Cloudflare will automatically detect the commit and run the build.
