export const PREDEFINED_CATEGORIES: Record<string, string[]> = {
  'Languages': ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'go', 'rust', 'swift', 'kotlin', 'r', 'matlab', 'sql', 'html', 'css', 'bash', 'shell'],
  'Frameworks': ['react', 'angular', 'vue', 'next.js', 'nuxt', 'svelte', 'django', 'flask', 'spring', 'express', 'ruby on rails', 'laravel', 'asp.net', 'fastapi'],
  'Cloud': ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'heroku', 'digitalocean', 'vercel', 'netlify', 'firebase', 'supabase'],
  'Databases': ['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'cassandra', 'dynamodb', 'elasticsearch', 'oracle', 'sql server', 'mariadb'],
  'DevOps & Tools': ['docker', 'kubernetes', 'jenkins', 'github actions', 'gitlab ci', 'terraform', 'ansible', 'git', 'webpack', 'vite', 'babel', 'linux', 'jira', 'confluence', 'trello', 'figma'],
  'Libraries': ['redux', 'zustand', 'recoil', 'mobx', 'rxjs', 'tailwind', 'bootstrap', 'material-ui', 'chakra ui', 'jquery', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch'],
};

/**
 * Groups an array of skill strings into an object categorized by predefined groups.
 * @param skills Array of skill strings (e.g., ['React', 'Python', 'Docker', 'Marketing'])
 * @returns Object with categories as keys and arrays of skills as values.
 */
export function categorizeSkills(skills: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {
    'Languages': [],
    'Frameworks': [],
    'Cloud': [],
    'Databases': [],
    'DevOps & Tools': [],
    'Libraries': [],
    'Other': []
  };

  skills.forEach(skill => {
    const normalizedSkill = skill.toLowerCase().trim();
    let foundCategory = false;

    for (const [category, keywords] of Object.entries(PREDEFINED_CATEGORIES)) {
      if (keywords.includes(normalizedSkill)) {
        categorized[category].push(skill);
        foundCategory = true;
        break;
      }
    }

    if (!foundCategory) {
      categorized['Other'].push(skill);
    }
  });

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categorized).filter(([_, skillsList]) => skillsList.length > 0)
  );
}

/**
 * Takes a plain list of skills and updates a resume JSON structure 
 * to use categorized skills instead of a flat list, if applicable.
 */
export function enhanceResumeSkills(resumeData: any) {
  if (!resumeData) return resumeData;
  
  const enhanced = { ...resumeData };
  
  if (Array.isArray(enhanced.skills) && enhanced.skills.length > 0) {
    if (typeof enhanced.skills[0] === 'string') {
      // It's a flat array of strings
      const categorized = categorizeSkills(enhanced.skills);
      
      // Convert to an array of objects if needed by the schema, 
      // or just keep it as an object
      enhanced.categorizedSkills = categorized;
    } else if (typeof enhanced.skills[0] === 'object' && enhanced.skills[0].name) {
      // Sometimes skills are array of { name: 'Skill', level: 'Expert' }
      const flatSkills = enhanced.skills.map((s: any) => s.name);
      enhanced.categorizedSkills = categorizeSkills(flatSkills);
    }
  }
  
  return enhanced;
}
