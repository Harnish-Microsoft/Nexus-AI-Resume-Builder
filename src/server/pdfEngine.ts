import { v4 as uuidv4 } from 'uuid';

/**
 * PRODUCTION-GRADE RESUME PDF RENDERING ENGINE
 * Designed for ATS compatibility and FAANG-level executive appearance.
 */

export interface ResumeData {
  personal_info: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };
  summary: string;
  skills: {
    [category: string]: string[];
  };
  experience: {
    id: string;
    role: string;
    company: string;
    location: string;
    duration: string;
    bullets: string[];
  }[];
  projects?: {
    name: string;
    role: string;
    duration: string;
    bullets: string[];
    link?: string;
  }[];
  education: {
    institution: string;
    degree: string;
    location: string;
    duration: string;
    gpa?: string;
  }[];
  certifications?: string[];
}

/**
 * PROFESSIONAL CSS SYSTEM
 * Optimized for Inter font and A4 print rendering.
 */
const PROFESSIONAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --text-main: #111827;
    --text-dim: #374151;
    --text-light: #6b7280;
    --accent: #111827;
    --border: #d1d5db;
  }

  * { box-sizing: border-box; }

  @page {
    size: A4;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif;
    color: var(--text-main);
    line-height: 1.45;
    background: white;
    width: 210mm;
    overflow-x: hidden;
  }

  .resume-container {
    width: 210mm;
    padding: 14mm 16mm;
    box-sizing: border-box;
    margin: 0 auto;
  }

  /* Page Break Management */
  .page-container {
    width: 100%;
    position: relative;
    page-break-after: always;
  }

  /* Section Styling */
  section {
    margin-bottom: 18px;
  }

  .section-header {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 5px;
    margin-bottom: 10px;
    margin-top: 18px;
    color: var(--accent);
  }

  /* Name Formatting */
  .resume-name {
    font-size: 24pt;
    font-weight: 700;
    letter-spacing: -0.5px;
    text-transform: uppercase;
    line-height: 1.1;
    margin-bottom: 4px;
  }

  .contact-info {
    font-size: 9pt;
    color: var(--text-dim);
    display: flex;
    justify-content: center;
    gap: 8pt;
    flex-wrap: wrap;
    margin-bottom: 18pt;
  }

  /* Bullets */
  ul {
    list-style: none;
    padding-left: 18px;
    margin-top: 6px;
    margin-bottom: 0;
  }

  li {
    position: relative;
    padding-left: 10px;
    margin-bottom: 5px;
    line-height: 1.45;
    font-size: 10pt;
  }

  li::before {
    content: "•";
    position: absolute;
    left: -2px;
    top: 0.02em;
    font-size: 11pt;
    color: var(--text-main);
  }

  /* Skills List */
  .skills-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    margin-top: 6px;
    font-size: 10pt;
  }

  .skill-row {
    margin-bottom: 4pt;
  }

  .skill-row b {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 9pt;
  }

  /* Certifications */
  .certifications-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
  }

  .certification-item {
    font-size: 10pt;
    font-weight: 500;
  }

  .education-section {
    break-before: avoid;
    page-break-before: avoid;
  }

`;

/**
 * PRODUCTION HTML RENDERER
 * Generates semantic HTML optimized for ATS and high-fidelity PDF.
 */
export function generateProfessionalHTML(data: ResumeData): string {
  const { personal_info, summary, skills, experience, projects, education, certifications } = data;

  // We only replace buzzwords here. We DO NOT truncate words to maintain accurate bullet counts from the AI generation phase.
  const sanitizeBullet = (bullet: string) => {
    return bullet
      .replace(/\b(Spearheaded|Orchestrated|Championed|Visionary|Dynamic|Massive-scale|World-class|Cutting-edge)\b/gi, 'Led')
      .replace(/\b(Architected|Engineered)\b/gi, 'Designed');
  };

  const renderBulletPoint = (text: string) => {
    const cleanText = text.replace(/^[•\-\*\u2022]\s*/, '').trim();
    return `
      <li style="display: flex; align-items: flex-start; margin-bottom: 3.5pt; font-size: 9.5pt; color: #374151;">
        <span style="margin-right: 6pt; line-height: 1.45; font-size: 10pt; color: #111827;">•</span>
        <span style="line-height: 1.45;">${cleanText}</span>
      </li>
    `;
  };

  const renderExperience = (item: any) => `
    <div class="experience-item" style="break-inside: avoid; margin-bottom: 12pt;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2pt;">
        <div>
          <span style="font-weight: 700; font-size: 11pt; color: #111827;">${item.role}</span>
          <span style="margin: 0 4px; color: #6b7280;">|</span>
          <span style="font-weight: 500; font-size: 10.5pt; color: #374151;">${item.company}</span>
        </div>
        <div style="font-size: 9.5pt; font-weight: 500; color: #6b7280;">${item.duration}</div>
      </div>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${item.bullets.map((b: string) => renderBulletPoint(sanitizeBullet(b))).join('')}
      </ul>
    </div>
  `;

  const header = `
    <header style="text-align: center; margin-bottom: 14pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 10pt;">
      <h1 style="font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; text-transform: uppercase; margin: 0 0 4pt 0; color: #111827;">
        ${personal_info.name}
      </h1>
      <div style="font-size: 9.5pt; color: #4b5563; display: flex; justify-content: center; gap: 12pt; flex-wrap: wrap;">
        ${[
          personal_info.email,
          personal_info.phone,
          personal_info.location,
          personal_info.linkedin,
          personal_info.website
        ].filter(Boolean).join('<span style="color: #d1d5db;">•</span>')}
      </div>
    </header>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page { size: A4; margin: 12mm 15mm; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Inter', sans-serif; 
          background: white; 
          width: 100%;
          margin: 0;
          padding: 0;
        }
        .section-header {
          font-size: 10.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #111827;
          padding-bottom: 2pt;
          margin: 14pt 0 8pt 0;
          color: #111827;
        }
        .skills-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4pt 12pt;
          font-size: 9.5pt;
        }
      </style>
    </head>
    <body>
      ${header}

      ${summary ? `
      <section style="break-inside: avoid;">
        <div class="section-header">Summary</div>
        <div style="font-size: 9.5pt; line-height: 1.5; color: #374151;">${summary}</div>
      </section>
      ` : ''}

      <section style="break-inside: avoid;">
        <div class="section-header">Core Competencies</div>
        <div class="skills-grid">
          ${Object.entries(skills).map(([cat, items]) => `
            <div style="font-weight: 600; color: #111827; text-align: right;">${cat}</div>
            <div style="color: #374151;">${items.join(', ')}</div>
          `).join('')}
        </div>
      </section>

      <section>
        <div class="section-header">Professional Experience</div>
        ${experience.map(renderExperience).join('')}
      </section>

      <section style="break-inside: avoid;">
        <div class="section-header">Education</div>
        ${education.map(e => `
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4pt;">
            <div>
              <span style="font-weight: 600; font-size: 10pt; color: #111827;">${e.degree}</span>
              <span style="margin: 0 4px; color: #6b7280;">|</span>
              <span style="font-size: 9.5pt; color: #374151;">${e.institution}</span>
            </div>
            <div style="font-size: 9.5pt; color: #6b7280;">${e.duration}</div>
          </div>
        `).join('')}
      </section>

      ${certifications && certifications.length > 0 ? `
        <section style="break-inside: avoid;">
          <div class="section-header">Professional Certifications</div>
          <ul style="margin: 0; padding: 0; list-style: none;">
            ${certifications.map(c => renderBulletPoint(c)).join('')}
          </ul>
        </section>
      ` : ''}
    </body>
    </html>
  `;
}
