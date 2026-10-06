# NexusPro AI: High-Performance Resume Intelligence System

NexusPro AI is a production-grade, full-stack application designed to transform how candidates interact with the modern recruitment landscape. It doesn't just "rewrite" resumes; it applies advanced engineering heuristics and multi-agent LLM pipelines to align professional history with high-stakes job requirements.

## 🚀 Key Features & Engine Logic

### 1. The NexusPro Optimization Pipeline (evidence-first)
Every engine follows the same evidence-first flow: the Hybrid engines run it on the server (`/api/v2/optimize`), and the Gemini and OpenAI engines run it in the browser (`optimizeResume` in `src/services/geminiService.ts`).

1. **Read everything, cut nothing silently**: A JSON master resume with role bullets is parsed in code, so every role and bullet is read exactly as written, with no model call. Free-form text goes through model extraction, reading up to 60,000 characters. For long job descriptions, company, benefits and EEO sections are set aside first. If anything is still cut, the `input_coverage` report names it.
2. **Job brief + verified evidence map**: One model call reads the posting and your own material (resume and brain dump). It returns a structured brief (title, seniority, minimum years, responsibilities and outcomes) and up to 25 requirements, each labelled required or nice-to-have and flagged as a hard eligibility gate when it is one. For every requirement, the model quotes your material verbatim. The quotes are then **verified in code**: a quote that cannot be found is discarded, and its requirement becomes *not evidenced*, whatever the model claimed. Logic: `src/lib/requirementEvidence.ts`.
3. **Evidence-led writing**: The whole-document, summary/skills and per-role prompts all receive the same posting text and the verified map. *Proven* requirements lead. *Partly proven* requirements are claimed only as far as their evidence goes. *Not evidenced* and *excluded* requirements are named as never to be claimed and belong in the keyword gap. Each role sees only the requirements its own bullets prove.
4. **Draft review that actually corrects**: Code checks the draft for excluded capabilities, figures your material never states, and posting terms or skills your material never mentions. One model review then looks for unsupported claims and proven requirements the draft never surfaces. One correction call rewrites **only the flagged parts**. Each replacement is re-checked in code and rejected if it still breaks a rule. Anything left is reported in `draft_verification`, never silently shipped. This replaces the old multi-agent feedback, which nothing applied. Fast mode runs only the checks in code. Logic: `src/lib/draftReview.ts`.
5. **Three separate measures**: The UI keeps three measures separate:
   - **Keyword Coverage** measures how much of the posting's wording the resume uses.
   - **Requirement Evidence** measures what your material proves. Rewording cannot change it, and hard eligibility gaps are shown even when coverage rises.
   - **Impact Audit** measures writing quality.

   None is a hiring probability.

- **Candidate exclusions (every engine)**: You do not claim **CI/CD** (including spelled-out "continuous integration/delivery/deployment"), **Pipelines**, **DevOps** or **Terraform**. Every prompt says so. Requirements naming them are reported as *Excluded by you*. LinkedIn trends never suggest them. Code removes them from skills and drops bullets that still name them, provided the role keeps another bullet. Job titles, employer names and certification names stay verbatim. The single source of truth is `src/lib/exclusions.ts`.
- **Deduplication & scoring**: Applies scoring algorithms to ensure content quality.
- **Deterministic keyword coverage**: The JD coverage score is computed in code, never guessed by the LLM. `src/lib/matchScore.ts` extracts weighted requirements from the posting using its skill dictionary, technical-token patterns, "experience with X" phrases and the analysis keywords that occur in the JD text. It then scores the original resume and the generated resume against that same list. The returned `score_breakdown` exposes every component — requirement coverage, proof-in-experience depth, role vocabulary alignment and years-of-experience fit — so the number shown in the UI is auditable. Its bands read as *coverage*, not *match*, because wording is not proof. When a posting carries too little signal to score honestly, the score fields are omitted rather than filled with a placeholder.
- **Logic**: The server pipeline lives in `server.ts`, `server/optimization.ts` and `server/roleGenerator.ts`. Shared logic used by both server and browser is in `src/lib/`. Run the regression tests with `npm test`.

### 2. Multi-Audience Strategy
Generate and manage multiple variations of your resume targeting different career trajectories (e.g., "Engineering Leader" vs "Solution Architect") simultaneously.
- **Logic**: Leverages the `AUDIENCES` state mapping in `src/App.tsx`.

### Optimization safeguards
- **Guided evidence collection**: In the Requirement Evidence card, expand **Add real evidence for a gap**. Eligibility gaps come first, followed by required requirements and nice-to-haves. Supply your employer/project, role, personal action and actual outcome. Saving appends the statement to your brain dump, saved locally in this browser. Run Optimize again to use it; saving alone never changes the current resume or evidence score. Excluded and already-proven requirements are not suggested. Clear Inputs also clears these notes.
- **Metric sources**: Draft review now checks figures against individual source statements, not just numbers anywhere in the material. Experience bullets must match the employer, the source role when attributed, numeric scale and units, and either the original wording or overlapping measurement vocabulary with a matching local measurement anchor. Named projects must also match their source title. Source statements are available under **Metric sources**. A number without a sufficiently close source is flagged for review, and corrections are checked by the same rule. This is a conservative heuristic, not semantic proof: paraphrases, number words and unit conversions may need manual confirmation. Employer attribution is required for free-text notes; custom instructions and the question's job-description wording are not evidence.
- **PDF export validation**: Downloads and Drive autosaves re-extract the actual generated PDF before releasing it. The check compares the rendered preview's text blocks (including visible headings, contact details and bullets) in order, checks empty pages, and reports the actual page count. Missing/changed text or reading-order problems stop that export; more than two pages is advisory, never an excuse to truncate content. The results pane shows the last check. This validates text preservation, not universal ATS compatibility or visual clipping; inspect the layout separately. DOCX exports are unchanged.
- **Logic**: `src/lib/evidenceCollection.ts`, `src/components/GuidedEvidenceForm.tsx`, `src/lib/metricProvenance.ts`, `src/lib/exportValidation.ts`, and `src/lib/pdfUtils.ts`.
- **Export review checkpoint**: PDF and DOCX exports refresh checks before proceeding. Unresolved claims or an incomplete/stale AI review require a per-export **Export anyway** acknowledgment; canceling produces no file. Eligibility gaps are advisories, not claims that rewriting can fix. Drive autosave pauses rather than bypassing this checkpoint. Downloading a DOCX marks the job as applied only if file generation succeeds.
- **Edit revalidation**: Changes to the active result, source resume, candidate notes, other master resumes, posting or target role refresh deterministic claim checks, metric provenance, keyword coverage and the Impact Audit. Edited content is never silently rewritten. The UI labels the result **checked in code**, invalidates the previous AI semantic review and generation-only reports, and asks you to run Optimize again for a full review. Evidence quotes are reverified for the same posting; a changed or unknown posting invalidates the old evidence map. Export rechecks immediately even if the UI refresh has not yet run, and rejects a version changed during confirmation.
- **Consistent source health**: The source-resume card uses `computeImpactScore` and `inspectBullet`, exactly like the results audit. JSON experience bullets and marked free-text bullets are supported. Contact details, dates and numbers in unrelated sections no longer earn measurable-impact points, and strong verbs count at bullet openings rather than anywhere in the document. Fewer than three experience bullets are not scored. Logic: `src/lib/resumeHealth.ts` and `src/lib/resumeValidation.ts`.

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
- **Evidence only**: a trending skill is used only when your master resume, brain dump or other master resumes show it. In a JSON master resume, contact details, company names and dates don't count as evidence, and the custom prompt never does. Trending skills you lack are listed as **Trending gaps** and never written in. Add one to your master resume only if it is true. Your excluded capabilities (see Candidate exclusions above) are never suggested, not even as gaps, and never count as evidence for another trending skill.
- **After generation**, every trending skill is labelled: in the resume, supported but not used, gap, or named without support. Skills entries that name only unsupported trending skills are removed. The **LinkedIn Trends** card in the results pane shows all of it. Match and impact scores ignore the trend list.
- **Why curated, not live**: LinkedIn has no public trends API, and the Gemini API terms for Grounding with Google Search forbid caching or modifying grounded results, so search results cannot steer generation. To refresh the trends, edit the catalogue in `src/lib/linkedinTrends.ts` and bump `CURATED_TRENDS_REVIEWED`. Cached results made with the old list are not reused.
- Switched off, nothing is sent: prompts, cache keys and output are exactly as before. The choice is saved in your browser and profile.
- Covers the pipeline the app uses (`/api/v2/optimize` and its in-browser fallback). The unused `/api/v3/optimize` route is unchanged.
- **Logic**: `src/lib/linkedinTrends.ts`, `src/components/LinkedInTrendsCard.tsx`.

### 11. AI Models & Engines (managed in the app)
Which AI models the app calls is data, not code. Admins manage them in **Admin Dashboard > AI Models**: open it from the chart icon in the header, or from **Manage AI models** under the engine picker. Every user's next call uses the saved models.
- **Primary and fallback per provider**: Gemini and OpenAI each have a primary model and an optional fallback. Every AI call, the tools included (quizzes, interview coach, job tracker, resume scan), runs on its provider's primary. If that fails, the fallback runs once. If the fallback also fails, or none is set, the run stops with an error naming each model and why. Nothing else is ever substituted, and a call never crosses to the other provider. A transient failure (rate limit, malformed answer) may retry the same models after a pause. The optional steps (evidence analysis and draft review) report a failure in their own card, and the run continues.
- **Adding a new model**: In AI Models, add the model ID exactly as the provider names it (for example `gemini-3.6-flash`). Add a display name, a Gemini thinking level, and optionally a price per 1M tokens. Press **Test**, which sends a one-word prompt to that model only, on your own key, with no fallback. Choose it as a primary or fallback, then **Save for every user**.
- **Changing primary/fallback**: Use the dropdowns in the Gemini or OpenAI panel, or **Set as primary** / **Set as fallback** beside a model in the list. For Gemini 3.6 Flash followed by Gemini 3.5 Flash, choose 3.6 Flash as primary first, then 3.5 Flash as fallback, then save. Choosing the current fallback as primary clears the fallback, so select a new one afterward. These settings are used by browser calls and server calls with personal keys; server calls on platform keys still use built-in models.
- **Engines** (the default is set in AI Models; users can switch for their session):

  | Engine | How it runs | Providers |
  |---|---|---|
  | Hybrid Gemini (default) | Server pipeline that reads, checks and writes each role separately | Gemini for every step |
  | Hybrid OpenAI | Server pipeline | Gemini reads and checks; OpenAI writes |
  | Gemini | One writing pass in the browser | Gemini only |
  | OpenAI | One writing pass in the browser | OpenAI only |

- **Fast mode** starts each call on the provider's fallback model, keeps the primary as its fallback, and skips the evidence analysis and the model review.
- **The header** shows the engine and the primary model in use, for example `HYBRID GEMINI · GEMINI 3.1 PRO`. Hover over it to see each provider's fallback and the models the last run used. If a primary failed during the last run, it turns amber and shows **Fallback used**.
- **Built-in defaults** apply until an admin saves, and whenever the saved catalog can't be read. Gemini 3.1 Pro (medium thinking) falls back to Gemini 3.6 Flash, GPT-4o falls back to GPT-4o mini, and Hybrid Gemini is the default engine. They are defined in `builtInCatalog()` in `src/lib/aiModels.ts`.
- **Storage**: Firestore `config/aiModels`. Everyone can read it; only admins can write it (`isAdmin()` in `firestore.rules`, which must match `ALL_USERS_ARE_ADMINS` / `ADMIN_EMAILS` in `src/constants.ts`). Currently every signed-in user with a verified email is an admin. The browser sends the catalog with each server request. The server uses it only with the user's own API key; the platform's key always runs on the built-in models.
- **Logic**:
  - `src/lib/aiModels.ts`: catalog, validation, routing and the primary-then-fallback runner.
  - `src/services/modelCatalog.ts`: loading, saving and live updates.
  - `server/modelRunner.ts`: server-side calls.
  - `src/components/AIModelManager.tsx`: the admin screen.

## 🛠 Technical Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion (animations).
- **Backend**: Express.js (Node.js) handling heavy AI computation and PDF generation.
- **Database/Auth**: Firebase Firestore & Authentication.
- **AI Core**: `@google/genai` (Gemini) and OpenAI, on the models chosen in Admin Dashboard > AI Models.
- **PDF Engine**: Puppeteer for pixel-perfect, ATS-parseable document exports.

## 📦 Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Firebase Configuration**:
   Update `firebase-applet-config.json` with your Firebase project credentials. Ensure Firestore and Auth are enabled.

3. **Firestore Rules**:
   Publish `firestore.rules` so that everyone can read the AI model catalog and only the admins can change it. In the Firebase console, open **Firestore Database** and select the database named by `firestoreDatabaseId` in `firebase-applet-config.json`. Open **Rules**, paste the contents of `firestore.rules`, and select **Publish**. Until the rules are published, the app runs on the built-in models and AI Models cannot save. Admins must sign in with a verified email address.

   **Troubleshooting a refused save**: AI Models shows the signed-in email, verification status, project, database, and a link to Firebase rules. The configured project is `airesumebuider`, and the database is `ai-studio-46d0b811-33d0-4b91-a2d2-d84e11607e87`, not `(default)`. Publish the entire repository rules file to that database, preserving the verified-admin restriction for `config/aiModels`. Saving refreshes the Firebase account and ID token first; an unverified or non-admin account receives a specific error before any write is attempted. If a verified admin is still denied, check the published rules on this named database, not only on the default database.

4. **API Keys**:
   Add your Gemini API Key in the application's **Profile > API Settings** section or set it as an environment variable in `.env`.

5. **Development**:
   ```bash
   npm run dev
   ```

6. **Production Build**:
   ```bash
   npm run build
   ```

## 🔒 Security & Privacy
NexusPro is built with privacy-first principles. Your Master Resume remains your own. LLM processing is stateless, and your data is only used to generate your specific document versions.

---
**Developer**: Harnish Jariwala  
**Contact**: hackerharnish@gmail.com
