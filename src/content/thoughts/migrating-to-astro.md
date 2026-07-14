---
title: 'Migrating to Astro'
description: 'Why I moved from Hexo to Astro for my digital garden.'
pubDate: 2025-12-18
tags: ['astro', 'web-dev', 'migration']
heroImage: '/placeholder-hero.jpg'
---

## Why Astro?

I needed something that felt more like a *platform* than a blog. Hexo was great, but **Astro** gives me:

1.  **Component Islands**: I can embed interactive React or Vue components (like my VR demos) directly into markdown.
2.  **Performance**: Zero JS by default.
3.  **Content Collections**: Type-safe frontmatter!

### The Migration Process

It was surprisingly easy. I just mapped my hexo `_posts` to Astro's `src/content/thoughts`.

```javascript
// Example code block
console.log("Hello Astro!");
```

Now my digital garden can actually grow efficiently.
