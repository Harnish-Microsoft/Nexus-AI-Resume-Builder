# NexusPro AI: High-Performance Resume Intelligence System

NexusPro AI is a production-grade, full-stack application designed to transform how candidates interact with the modern recruitment landscape. It doesn't just "rewrite" resumes; it applies advanced engineering heuristics and multi-agent LLM pipelines to align professional history with high-stakes job requirements.

## 🚀 Key Features & Engine Logic

### 1. The NexusPro Optimization Pipeline (`/api/optimize-pipeline`)
Unlike simple prompt-based wrappers, NexusPro uses a multi-stage server-side pipeline:
- **Requirement Deconstruction**: Analyzes JDs to extract explicit and implicit technical/leadership requirements.
- **Agentic Role Synthesis**: Spawns concurrent LLM tasks for each professional role to generate STAR-method achievements tailored specifically to the target job description.
- **Deduplication & scoring**: Applies scoring algorithms to ensure content quality.
- **Deterministic match scoring**: The JD match score is computed in code, never guessed by the LLM. `src/lib/matchScore.ts` extracts weighted requirements from the posting (skill dictionary, technical-token patterns, "experience with X" phrases, plus extraction-stage keywords verified against the JD text), then scores the original resume and the generated resume against that same list. The returned `score_breakdown` exposes every component — requirement coverage, proof-in-experience depth, role vocabulary alignment and years-of-experience fit — so the number shown in the UI is auditable. When a posting carries too little signal to score honestly, the score fields are omitted rather than filled with a placeholder.
- **Logic**: Implemented in Node.js using `server/optimization.ts` and `server/roleGenerator.ts`.

### 2. Multi-Audience Strategy
Generate and manage multiple variations of your resume targeting different career trajectories (e.g., "Engineering Leader" vs "Solution Architect") simultaneously.
- **Logic**: Leverages the `AUDIENCES` state mapping in `src/App.tsx`.

### 3. NexusPro Insights (STAR Story Generation)
The AI doesn't just tailor bullets; it prepares you for the interview. It extracts high-impact bullets and builds comprehensive STAR stories (Situation, Task, Action, Result) for each.
- **Logic**: Viewable in the "Insights" pane, powered by `NexusProInsights.tsx`.

### 4. Interactive Style & Layout Engine
A complete DTP-style interface to control the resume's visual identity.
- **Controls**: Live font switching (Sans/Mono/Serif), fluid margin/padding adjustments, and drag-and-drop section reordering.
- **Logic**: Powered by `@dnd-kit/core` and a custom `FormattingContext`.

### 5. Job Tracker & CRM
A built-in workflow manager to track applications, document metadata, and track historical match scores.
- **Logic**: `src/components/JobTracker.tsx` integrated with Firestore for persistence.

### 6. ATS Autofill floating Helper
A floating utility that overlays job application portals. It provides quick-copy access to your tailored resume data, categorized by field, specifically filtered to match job board requirements.
- **Logic**: `src/components/ATSAutofillHelper.tsx`.

### 7. Secure Encryption Layer
All sensitive API keys (Gemini, OpenAI) are never stored in plain text. They are encrypted at the server level using stable, hardware-backed keys and AES-256-CBC.
- **Logic**: `encrypt()` and `decrypt()` routines in `server.ts`.

### 8. Global Command Palette (`Cmd+K`)
A unified search and action bar for high-efficiency navigation across the entire application workspace.

### 9. Bullet Rules (how many bullets each role gets)
You decide how deep the roles that matter go; the system sizes the rest. Edit the rules on the **Profile** tab, where a live preview shows every role's budget against your master resume. The **Build** tab shows a one-line summary.

| Rule | Default | Bullets |
|---|---|---|
| Most recent roles (by end date, current roles first) | 2 most recent | 6-7 |
| Pinned companies | HCLTech | 2 |
| Other roles that show your platform | Azure (a platform named in the job description wins when one of your roles shows it) | 4-5 |
| Every other role | Tenure tiers, decided by the system | 1-4 |
| 2-page fit | On, 32 bullets in total | Trims the oldest system-sized roles first |

- **Precedence** (first match wins): pinned company, then the most recent roles, then platform match, then tenure tiers. A pinned company keeps its count even when it is one of the most recent roles.
- **Platform match** reads only the role's own title and bullets, so the job description alone never makes a role "Azure".
- **Tenure tiers** for the rest: 2 months or less gets 1 bullet, 3-6 months 1-2, 7-12 months 2-3, 13-23 months 2-3, 24+ months 3-4, and a role that ended more than 10 years ago 1-2. A role whose dates can't be read is capped at 7. With the recent-roles rule off, the latest substantial role gets the original 4-5 or 6-7.
- **2-page fit** lowers system-sized roles one bullet at a time, oldest first, never below one bullet. Roles covered by your rules are never trimmed.
- **Bullets are never invented.** A role whose source has fewer achievements than its rule asks for keeps what it has, and the results say so. When the model writes too many, the weakest bullets are removed.
- The **Bullet Budget** card in the results pane lists each role's budget, why it got it, and anything removed.
- Saved in your browser and, when signed in, in your profile. Switching the rules off restores the original tenure-only budgets exactly.
- **Logic**: `src/lib/bulletBudget.ts` (planning and enforcement), `src/lib/bulletRulesPreview.ts`, `src/components/BulletRulesSettings.tsx`, `src/components/BulletBudgetReportCard.tsx`.

### 10. LinkedIn Trends (evidence only)
**Follow LinkedIn trends** (Build tab, on by default) steers each resume toward the skills trending on LinkedIn for the target role, but only the ones your own material supports.
- **Trend list**: a curated catalogue of role families (Azure, AWS and Google Cloud, cloud engineering, infrastructure and operations, modern workplace, SRE and platform engineering, cybersecurity, data and AI, software engineering, solution architecture, technology leadership, and a general list), reviewed against LinkedIn's published skill trends (`CURATED_TRENDS_REVIEWED`, currently 2026-10). The target role and job description select up to three families and 32 skills. The Build tab names the list the next run will follow.
- **Evidence only**: a trending skill is used only when your master resume, brain dump or other master resumes show it. In a JSON master resume, contact details, company names and dates don't count as evidence, and the custom prompt never does. Trending skills you lack are listed as **Trending gaps** and never written in. Add one to your master resume only if it is true.
- **After generation**, every trending skill is labelled: in the resume, supported but not used, gap, or named without support. Skills entries that name only unsupported trending skills are removed. The **LinkedIn Trends** card in the results pane shows all of it. Match and impact scores ignore the trend list.
- **Why curated, not live**: LinkedIn has no public trends API, and the Gemini API terms for Grounding with Google Search forbid caching or modifying grounded results, so search results cannot steer generation. To refresh the trends, edit the catalogue in `src/lib/linkedinTrends.ts` and bump `CURATED_TRENDS_REVIEWED`. Cached results made with the old list are not reused.
- Switched off, nothing is sent: prompts, cache keys and output are exactly as before. The choice is saved in your browser and profile.
- Covers the pipeline the app uses (`/api/v2/optimize` and its in-browser fallback). The unused `/api/v3/optimize` route is unchanged.
- **Logic**: `src/lib/linkedinTrends.ts`, `src/components/LinkedInTrendsCard.tsx`.

## 🛠 Technical Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion (animations).
- **Backend**: Express.js (Node.js) handling heavy AI computation and PDF generation.
- **Database/Auth**: Firebase Firestore & Authentication.
- **AI Core**: Native integration with `@google/genai` (Gemini 1.5 Pro) and OpenAI.
- **PDF Engine**: Puppeteer for pixel-perfect, ATS-parseable document exports.

## 📦 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Firebase Configuration**:
   Update `firebase-applet-config.json` with your Firebase project credentials. Ensure Firestore and Auth are enabled.

3. **API Keys**:
   Add your Gemini API Key in the application's **Profile > API Settings** section or set it as an environment variable in `.env`.

4. **Development**:
   ```bash
   npm run dev
   ```

5. **Production Build**:
   ```bash
   npm run build
   ```

## 🔒 Security & Privacy
NexusPro is built with privacy-first principles. Your Master Resume remains your own. LLM processing is stateless, and your data is only used to generate your specific document versions.

---
**Developer**: Harnish Jariwala  
**Contact**: hackerharnish@gmail.com
