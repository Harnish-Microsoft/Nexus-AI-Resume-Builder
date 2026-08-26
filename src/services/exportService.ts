import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { formatCertification } from '../lib/certifications';

export const downloadDOCX = async (res: any, targetRole: string, companyName: string, showToast: (msg: string, type: any) => void) => {
  if (!res) return;

  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Header - 2 Lines
            new Paragraph({
              children: [
                new TextRun({
                  text: res.personal_info?.name || '',
                  bold: true,
                  size: 28, // 14pt
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${res.personal_info?.location || ''} | ${res.personal_info?.email || ''} | ${res.personal_info?.phone || ''} | ${res.personal_info?.linkedin || ''}`,
                  size: 18, // 9pt
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // Summary
            new Paragraph({
              text: "PROFESSIONAL SUMMARY",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: (res as any).summary || (res as any).personal_info?.summary || "",
                  size: 20, // 10pt
                }),
              ],
              spacing: { after: 200 },
            }),

            // Skills
            new Paragraph({
              text: "TECHNICAL SKILLS",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: Array.isArray(res.skills) 
                ? res.skills.join(", ") 
                : Object.entries(res.skills).map(([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`).join(" | "),
              spacing: { after: 200 },
            }),

            // Experience
            new Paragraph({
              text: "PROFESSIONAL EXPERIENCE",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
            ...res.experience.flatMap((exp: any) => [
              new Paragraph({
                children: [
                  new TextRun({ text: exp.role, bold: true }),
                  new TextRun({ text: `\t${exp.duration}`, bold: true }),
                ],
                tabStops: [
                  {
                    type: AlignmentType.RIGHT,
                    position: 9000,
                  },
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: exp.company, italics: true, color: "444444" }),
                ],
                spacing: { after: 100 },
              }),
              ...exp.bullets.map((bullet: string) => 
                new Paragraph({
                  text: bullet,
                  bullet: { level: 0 },
                })
              ),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ]),

            // Projects
            ...(res.projects && res.projects.length > 0 ? [
              new Paragraph({
                text: "STRATEGIC PROJECTS",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 100 },
              }),
              ...res.projects.flatMap((proj: any) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: typeof proj === 'string' ? proj : proj.title, bold: true }),
                  ],
                }),
                ...(typeof proj !== 'string' && proj.description ? [
                  new Paragraph({
                    text: proj.description,
                    bullet: { level: 0 },
                    spacing: { after: 100 },
                  })
                ] : [
                  new Paragraph({ text: "", spacing: { after: 100 } })
                ]),
              ]),
            ] : []),

            // Certifications
            ...(res.certifications && res.certifications.length > 0 ? [
              new Paragraph({
                text: "CERTIFICATIONS",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 100 },
              }),
              ...res.certifications.map((cert: string) => 
                new Paragraph({
                  text: formatCertification(cert),
                  bullet: { level: 0 },
                })
              ),
            ] : []),

            // Education
            new Paragraph({
              text: "EDUCATION",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
            ...res.education.map((edu: any) => 
              new Paragraph({
                text: typeof edu === 'string' ? edu : `${edu.degree} - ${edu.institution} (${edu.expected_completion})`,
                bullet: { level: 0 },
              })
            ),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const role = targetRole || 'Resume';
    const company = companyName ? `-${companyName}` : '';
    const docxTitle = `${role}${company}_Harnish Jariwala`;
    
    saveAs(blob, `${docxTitle}.docx`);
    showToast('DOCX Downloaded successfully!', 'success');
  } catch (err: any) {
    console.error('DOCX Generation Error:', err);
    showToast('Failed to generate DOCX. Please try again.', 'error');
  }
};

export const downloadJSON = (res: any, targetRole: string, companyName: string, showToast: (msg: string, type: any) => void) => {
  if (!res) return;
  try {
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const role = targetRole || 'Resume';
    const company = companyName ? `-${companyName}` : '';
    const fileName = `${role}${company}_Harnish Jariwala.json`;
    saveAs(blob, fileName);
    showToast('JSON Exported successfully!', 'success');
  } catch (err: any) {
    console.error('JSON Export Error:', err);
    showToast('Failed to export JSON.', 'error');
  }
};
