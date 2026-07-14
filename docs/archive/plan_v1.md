# Topic-First Architecture Implementation Plan & Task List

## Task List
- [x] Schema Updates
    - [x] Update `src/content/config.ts` to add `tags` to `lab` collection
- [x] Content Updates
    - [x] Add tags to `src/content/lab/interactive-demo.mdx`
    - [x] Add tags to `src/content/lab/vr-locomotion.md`
- [x] Feature Implementation
    - [x] Create `src/pages/topics/[tag].astro` dynamic route
    - [x] Implement aggregation logic (fetch from all 3 collections)
    - [x] Design the Topic Explorer layout
- [x] Homepage Integration
    - [x] Update `src/pages/index.astro` cards to link to topic pages
    - [x] Ensure tags in cards match the actual content tags
- [x] Navigation & Refinements
    - [x] Create `Navigation.astro` component
    - [x] Add `about.astro` page
    - [x] Add Navigation to `[tag].astro`
    - [x] Fix URL casing (normalize to lowercase paths)
- [x] Verification
    - [x] Verify homepage links work
    - [x] Verify topic page displays content from multiple sources

---

# Detailed Implementation Plan: Refine Topic Page Navigation

## Goal Description
The user requested a review of the navigation design (Topic vs. Format) and noted the missing "About" link on topic pages.
**Design Recommendation**: We will **maintain** the current "Physical/Format" navigation (Garden, Lab, Thoughts) because:
1.  **Scalability**: Topics (VR, AI, Design...) grow indefinitely, cluttering the bar. Formats are stable.
2.  **Expectations**: "Lab" tells the user "this is a demo", "Thoughts" says "this is an essay". This is valuable context.
3.  **Hybrid Approach**: We use the Top Nav for *Structure* (where am I?) and the Body/Cards for *Topics* (what am I interested in?).

We will also fix the missing `/about` page and inconsistent headers.

## User Review Required
> [!NOTE]
> **New File**: Creating `src/pages/about.astro` as it is linked but missing.

## Proposed Changes

### Components
#### [NEW] `src/components/Navigation.astro`
- Extract `<nav>` from `src/pages/index.astro`.
- Links: **Garden, Lab, Thoughts, About**.
- Styling: Consolidated glassmorphism styles.

### Pages
#### [NEW] `src/pages/about.astro`
- Simple "About" page using `Layout`.
- Content: Placeholder "About the Gardener" text.

#### [MODIFY] `src/pages/index.astro`
- Replace inline nav with `<Navigation />`.

#### [MODIFY] `src/pages/topics/[tag].astro`
- Integrate `<Navigation />` at the top.

## Verification Plan

### Manual Verification
- **Browser Check**:
    - Verify Nav appears on Homepage and Topic Page.
    - Click "About" -> Verify it loads (no 404).
    - Verify design consistency.
