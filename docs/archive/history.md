# Project History: The Brain Dump
*A comprehensive record of the design evolution, architectural decisions, and philosophical underpinnings of "Between Binary" (From2050).*

---

## 📅 Initial State & The "Why"
**Where we started:**
- The site was running on **Hexo** (Butterfly theme).
- It worked, but it was "just a blog". It felt static.
- **The Problem**: You carry a vision of a "VR Immersive Academy" and a "Digital Garden". Hexo's rigid "post-by-date" structure fought against this. You couldn't easily embed a 3D React component into a standard Markdown blog post without hacking the theme.
- **The Goal**: Move to **Astro**. Why? Because it brings the "Garden" (static content) and the "Lab" (React/interactive content) together seamlessly.

---

## 🧠 Design Evolution: The Search for "Soul"

### Phase 1: The "Clean but Cold" Prototype (V1)
*The default engineer approach.*
- **Action**: I built a standard Astro + Tailwind site.
- **Result**: It was fast, clean, and dark.
- **Critique**: It looked like a generic "Developer Portfolio". It had "nodes" and "networks", but they looked like server diagrams. It lacked *humanity*.
- **Key Realization**: "Cyberpunk" or "High-Tech" often ends up feeling cold and dystopian. That is **not** what From2050 represents.

### Phase 2: The "Humanistic Tech" Pivot (V2)
*The "Warmth" Directive.*
- **Your Feedback**: You specifically asked for "Warmth" and an "Organic" feel. You didn't want the site to feel like a machine.
- **The Shift**:
    - **Metaphor Change**: We moved from "Network Nodes" (rigid, wired) to "Particles" (fluid, floating, alive).
    - **Color Theory**: We abandoned the "Matrix Green" or "Cyber Blue". We introduced a **"Sunset/Cosmic" palette**—deep purples blending into warm oranges. It signals: "Technology that serves life," not "Technology that consumes life."
    - **Glassmorphism**: We used frosted glass cards. This adds depth and texture, making the UI feel tactile, like a physical object, rather than flat pixels.

### Phase 3: The "Laboratory" Identity (V3)
*Defining the space.*
- We struggled with what to call things. "Posts"? "Articles"? "Projects"?
- **The Taxonomy Decision**:
    1.  **Garden**: Knowledge that grows. These are verified guides, wikis, and structured learning.
    2.  **Lab**: Experiments. These are rough, interactive, and prototypes.
    3.  **Thoughts**: Essays and opinions. The human voice.
- **Why this matters**: This isn't just naming; it sets **expectations**. A user entering the "Lab" expects things might break but will be cool. A user in the "Garden" expects reliability.

---

## 🏗 Architecture: The "Topic-First" Revolution
*The most critical structural decision we made.*

### The Conflict
Traditional blogs organize by **Format**: "Here are my Videos," "Here are my Posts."
But a user interested in **Virtual Reality** doesn't care about format. They want *everything* you know about VR—the essay, the demo, and the notes.

### The Solution: Aggregated Topic Pages
We flipped the hierarchy.
- **Old Way**: User clicks "Blog" -> Searches for "VR".
- **New Way**: User sees a "VR" card on the home page -> Clicks it -> **The system fetches**:
    - The "VR Locomotion" experiment from the **Lab**.
    - The "History of VR" node from the **Garden**.
    - The "Future of Immersion" essay from **Thoughts**.
- **Implementation**: This required a dynamic route `src/pages/topics/[tag].astro` that queries *all three* content collections simultaneously and merges them.

---

## 🎨 Aesthetic Details: The Micro-Decisions

### 1. Typography: Space Grotesk
We needed a font that said "Future" but not "Robot".
- **Why Space Grotesk?**: It has the geometric precision of a tech font, but it has "quirky" curves (like the lowercase 'r' and 'g'). It feels tailored and human, not default.

### 2. The Navigation Bar philosophy
*Conversation: "Where do we put the topics?"*
- **Decision**: Keep the Top Nav **stable** and **minimal** (Garden, Lab, Thoughts, About).
- **Reasoning**: If we put "VR", "AI", "Web" in the top hub, the menu becomes a mess as you learn new things. The Top Nav is for "Where am I regarding content *type*?". The Body is for "What *subject* am I exploring?".

### 3. The Interactive "Hero"
We didn't just want a static image.
- **The Dream**: A 3D/Canvas background that reacts to the mouse.
- **The Compromise**: For V1, we used css-driven gradients and glass effects to simulate depth. The *real* 3D interactivity is reserved for the individual "Lab" posts (using MDX) to keep the homepage load time instant.

---

## 🌌 2026-10-02: World Loading, Near to Far

The World entrance originally waited for distant mountain geometry and about 8.1 MB of alpine rock textures before visitors could enter. A previous attempt to open the button earlier was reverted because the nearby clearing still looked unfinished. The design requirement is that the cabin, ground, fire ring, trees, plants, and their materials are present when entry becomes available.

The nearby models and textures now begin loading alongside the ground maps. Three small procedural ridges establish the distant horizon and its lake reflection immediately. After the nearby scene is ready, the authored 3D mountain mesh loads and fades in over 1.8 seconds. Procedural rock and snow shading replaces the large alpine texture set. The mountains retain their 3D form without making the distant detail part of the entry gate. The implementation and profiling markers are described in `docs/WORLD.md`.

We tested the old and new builds on separate Cloudflare Pages preview domains on 2026-10-02. The baseline build changed only to record the first entry-ready time. Two cold, real-network transfers measured **6.09 and 3.94 seconds** for the baseline versus **4.55 and 2.11 seconds** for the new build: reductions of **1.53 and 1.83 seconds**. At entry, transferred resources fell from about **26.15 MB** to **17.73 MB**; the completed new scene transferred about **18.05 MB**. The distant mountain finished fading in at **7.53 and 4.41 seconds**. These are two observed visits, not a universal loading-time guarantee; network conditions varied substantially between them.

---

## 🔮 Unfinished Thoughts & Future Roadmap
*Ideas we touched on but haven't fully built yet.*

1.  **The "Mind Map" Visualization**:
    - *Idea*: A literal 3D graph view of your notes (Obsidian-style) on the deployments.
    - *Status*: Deferred. We need more content first for this to look good.

2.  **"Seedling" vs "Tree" Indicators**:
    - *Idea*: Visually distinguishing "Garden" nodes by their maturity (Stub vs Complete).
    - *Status*: The frontmatter `stage: seedling` exists, but we haven't added the visual icons yet.

3.  **The VR Entry Point**:
    - *Idea*: A "WebXR" button that launches the site in an immersive mode.
    - *Status*: Reserved for a future "Lab" experiment.

---

## 🏁 Summary of Requirements for Maintenance
1.  **Never lose the Warmth**: If it starts looking like a Bootstrap template, we failed.
2.  **Content is King**: The `src/content/` folder is the brain. The code is just the body.
3.  **Keep it "Between Binary"**: The site must exist in the tension between "Structured Code" (Binary) and "Organic Thought" (Between). It is a **Digital Garden**, not a filing cabinet.
