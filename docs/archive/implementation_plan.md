# Refine Topic Page Navigation

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
#### [NEW] [Navigation.astro](file:///C:/Users/jay/Desktop/personal/From2050.github.io/between-binary/src/components/Navigation.astro)
- Extract `<nav>` from [index.astro](file:///C:/Users/jay/Desktop/personal/From2050.github.io/between-binary/src/pages/index.astro).
- Links: **Garden, Lab, Thoughts, About**.
- Styling: Consolidated glassmorphism styles.

### Pages
#### [NEW] [about.astro](file:///C:/Users/jay/Desktop/personal/From2050.github.io/between-binary/src/pages/about.astro)
- Simple "About" page using `Layout`.
- Content: Placeholder "About the Gardener" text.

#### [MODIFY] [index.astro](file:///C:/Users/jay/Desktop/personal/From2050.github.io/between-binary/src/pages/index.astro)
- Replace inline nav with `<Navigation />`.

#### [MODIFY] [[tag].astro](file:///C:/Users/jay/Desktop/personal/From2050.github.io/between-binary/src/pages/topics/[tag].astro)
- Integrate `<Navigation />` at the top.

## Verification Plan

### Manual Verification
- **Browser Check**:
    - Verify Nav appears on Homepage and Topic Page.
    - Click "About" -> Verify it loads (no 404).
    - Verify design consistency.
