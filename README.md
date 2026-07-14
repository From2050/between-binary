# Between Binary 🌌

> A digital garden for cultivating immersive tech — exploring the space between code and creativity.

**Live site**: deployed on [Cloudflare Pages](https://pages.cloudflare.com/) · Built with [Astro](https://astro.build) + React + TailwindCSS

![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## What is this?

Between Binary is not a blog — it's a **digital garden**: a living network of notes, experiments, and ideas that grow over time. Content is organized into three collections:

| Collection | What lives here | Growth model |
|---|---|---|
| 🌱 **Garden** (`src/content/garden/`) | Evolving knowledge notes | `seedling` → `budding` → `evergreen` |
| 🧪 **Lab** (`src/content/lab/`) | Projects & interactive experiments (MDX) | `concept` → `prototype` → `beta` → `release` |
| ✍️ **Thoughts** (`src/content/thoughts/`) | Long-form essays & posts | dated posts |

Everything is cross-linked by tags via `/topics/[tag]` pages.

## Quick Start

```bash
npm install      # install dependencies
npm run dev      # start dev server → http://localhost:4321
npm run build    # production build → dist/
npm run preview  # preview the production build
```

No Node.js installed? See [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md) to run everything in Docker.

## Project Structure

```
├── src/
│   ├── pages/          # Routes (index, garden, lab, thoughts, topics, about)
│   ├── content/        # Markdown/MDX content collections (garden / lab / thoughts)
│   ├── components/     # Astro & React components (StarMap, NeuroBackground, …)
│   ├── layouts/        # Base layout (fonts, theme, background)
│   └── styles/         # Global CSS (Tailwind)
├── public/             # Static assets (favicon, images) — served as-is
├── docs/
│   ├── MAINTENANCE.md  # How to add & maintain content
│   ├── DOCKER_RUN.md   # Docker-based dev workflow
│   └── archive/        # Design history & planning docs from the Hexo → Astro rebuild
├── astro.config.mjs
└── tailwind.config.mjs
```

## Adding Content

Create a Markdown/MDX file in the matching collection folder — the schema is enforced by `src/content/config.ts`:

```markdown
---
title: 'My New Note'
description: 'One-line summary.'
updatedDate: 2026-07-14
stage: 'seedling'        # garden only: seedling | budding | evergreen
tags: ['vr', 'design']
---

Write in Markdown. Lab entries can use `.mdx` to embed React components.
```

Full guide: [docs/MAINTENANCE.md](docs/MAINTENANCE.md)

## Deployment (Cloudflare Pages)

The site auto-deploys from the default branch. Build settings:

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |

---

<a name="繁體中文"></a>

# 繁體中文說明 🇹🇼

「Between Binary」是一座**數位花園** — 不是部落格，而是一個會隨時間生長的筆記與實驗網絡。

## 內容的三個區域

- 🌱 **Garden（花園）**：持續演化的知識筆記，成長階段為 `seedling`（幼苗）→ `budding`（發芽）→ `evergreen`（常青）
- 🧪 **Lab（實驗室）**：專案與互動實驗，可用 MDX 嵌入 React 元件，狀態為 `concept` → `prototype` → `beta` → `release`
- ✍️ **Thoughts（隨筆）**：長文與部落格式文章，依日期排序

## 如何新增文章

1. 在 `src/content/` 對應的資料夾（`garden/`、`lab/`、`thoughts/`）建立 `.md` 或 `.mdx` 檔案
2. 依照上方範例填寫 frontmatter（欄位定義在 `src/content/config.ts`，缺欄位建置時會報錯提醒）
3. Lab 文章用 `.mdx` 副檔名即可在文章中直接使用 React / Astro 元件

詳細教學見 [docs/MAINTENANCE.md](docs/MAINTENANCE.md)。

## 本地預覽

```bash
npm install    # 第一次需要安裝依賴
npm run dev    # 開發伺服器，瀏覽器開 http://localhost:4321
```

沒裝 Node.js 的話可以用 Docker，見 [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md)。

## 部署注意事項

- 部署由 **Cloudflare Pages** 自動處理：push 到預設分支即觸發建置，不需要 GitHub Actions
- Cloudflare 設定：Build command 是 `npm run build`、輸出目錄是 `dist`、Root directory 是 `/`（repo 根目錄）
- `public/` 內的檔案（favicon、圖片）會原樣複製到網站根路徑，文章圖片放在 `public/images/` 下引用

## 歷史沿革

本站前身為 Hexo 部落格，2025 年底改用 Astro 重建。當時的設計演進紀錄與規劃文件封存在 [docs/archive/](docs/archive/)。
