export const demoAccounts = [
  {
    persona: 'HR_MANAGER',
    email: 'manager.hr@lakarya.local',
    label: 'Manager HR',
    role: 'MANAJER',
    department: 'Human Resources',
  },
  {
    persona: 'FINANCE_MANAGER',
    email: 'manager.fin@lakarya.local',
    label: 'Manager Finance',
    role: 'MANAJER',
    department: 'Finance',
  },
  {
    persona: 'IT_MANAGER',
    email: 'manager.it@lakarya.local',
    label: 'Manager IT',
    role: 'MANAJER',
    department: 'Information Technology',
  },
  {
    persona: 'MARKETING_MANAGER',
    email: 'manager.mkt@lakarya.local',
    label: 'Manager Marketing',
    role: 'MANAJER',
    department: 'Marketing',
  },
  {
    persona: 'IT_STAFF',
    email: 'staff.it@lakarya.local',
    label: 'Staf IT',
    role: 'STAF',
    department: 'Information Technology',
  },
] as const;

export type DemoPersona = (typeof demoAccounts)[number]['persona'];

const demoAccountEmails = new Set(
  demoAccounts.map((account) => account.email.toLowerCase()),
);

export function findDemoAccount(persona: string) {
  return demoAccounts.find((account) => account.persona === persona);
}

export function isDemoAccountEmail(email: string) {
  return (
    isDemoModeEnabled() &&
    demoAccountEmails.has(email.trim().toLowerCase())
  );
}

export function isDemoModeEnabled() {
  return ['true', '1', 'yes'].includes(
    process.env.DEMO_MODE?.trim().toLowerCase() ?? '',
  );
}
