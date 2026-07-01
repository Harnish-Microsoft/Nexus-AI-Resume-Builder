import { readFileSync } from 'fs';
import path from 'path';

export function renderResumeToHTML(): string {
  const resumeJson = JSON.parse(readFileSync(path.join(process.cwd(), 'src/services/master_resume.json'), 'utf8'));
  const { personal_info, summary, experience, education, certifications } = resumeJson;

  let html = `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { 
            font-family: 'Inter', sans-serif; 
            padding: 0.75in; 
            font-size: 10pt; 
            line-height: 1.5; 
            color: #1a1a1a; 
            background-color: #ffffff;
          }
          h1 { 
            font-size: 24pt; 
            font-weight: 700; 
            margin: 0 0 10px 0; 
            text-transform: uppercase; 
            letter-spacing: -0.02em;
            color: #000000;
          }
          .contact { 
            text-align: center; 
            margin-bottom: 30px; 
            font-size: 9pt; 
            color: #4b5563;
          }
          h2 { 
            font-size: 11pt; 
            font-weight: 600; 
            text-transform: uppercase; 
            letter-spacing: 0.05em;
            border-bottom: 1px solid #e5e7eb; 
            padding-bottom: 4px; 
            margin: 20px 0 10px 0; 
            color: #374151;
          }
          .summary { margin-bottom: 20px; color: #4b5563; }
          .job { margin-bottom: 15px; }
          .job-header { 
            display: flex; 
            justify-content: space-between; 
            font-weight: 600; 
            margin-bottom: 5px;
            color: #111827;
          }
          ul { margin: 5px 0; padding-left: 18px; }
          li { margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <h1>${personal_info.name}</h1>
        <div class="contact">
          ${personal_info.email} &bull; ${personal_info.phone} &bull; ${personal_info.location}
        </div>
        
        <h2>Summary</h2>
        <div class="summary">${summary}</div>
        
        <h2>Professional Experience</h2>
        ${experience.map((job: any) => `
          <div class="job">
            <div class="job-header">
              <span>${job.role}, ${job.company}</span>
              <span>${job.duration}</span>
            </div>
            <ul>
              ${job.bullets.map((bullet: any) => `<li>${bullet}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
        
        <h2>Education</h2>
        <div>
          <strong>${education.degree}</strong> at ${education.institution}, Expected: ${education.expected_completion}
        </div>
      </body>
    </html>
  `;
  return html;
}
