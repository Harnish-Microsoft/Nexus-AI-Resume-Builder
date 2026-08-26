import { Certification } from '../types';

const CERTIFICATION_CODES: Record<string, string> = {
  'Azure Solutions Architect Expert': 'AZ-305',
  'Azure Administrator Associate': 'AZ-104',
  'Azure Fundamentals': 'AZ-900',
};

export const formatCertification = (certification: Certification | string): string => {
  const name = typeof certification === 'string' ? certification : certification.name;
  const code = CERTIFICATION_CODES[name];
  return code ? `${name} (${code})` : name;
};
