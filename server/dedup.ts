export function deduplicateAndScore(experience: any[]) {
  return experience.map(role => {
    const seen = new Set();
    const uniqueBullets = role.bullets.filter((b: string) => {
      const key = b.toLowerCase().replace(/\W/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ...role,
      bullets: uniqueBullets,
      score: uniqueBullets.length * 10
    };
  });
}
