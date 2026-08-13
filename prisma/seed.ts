import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  AccountStatus,
  PrismaClient,
  RoleName,
} from '../src/generated/prisma/client';
import {
  demoAccounts,
  isDemoModeEnabled,
} from '../src/common/demo-accounts';
import { getDatabaseConnectionConfig } from '../src/prisma/database.config';

const adapter = new PrismaMariaDb(getDatabaseConnectionConfig());
const prisma = new PrismaClient({ adapter });

const roles = [
  { name: RoleName.STAF, description: 'Karyawan staf' },
  { name: RoleName.MANAJER, description: 'Manajer departemen' },
];

const departments = [
  { code: 'HR', name: 'Human Resources' },
  { code: 'FIN', name: 'Finance' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'MKT', name: 'Marketing' },
];

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');

  return `scrypt:${salt}:${hash}`;
}

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department.name },
      update: {},
      create: {
        name: department.name,
        description: `Departemen ${department.name}`,
      },
    });
  }

  const [managerRole, staffRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.MANAJER } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.STAF } }),
  ]);
  const managerPassword = process.env.SEED_MANAGER_PASSWORD;

  if (!managerPassword) {
    throw new Error(
      'SEED_MANAGER_PASSWORD wajib diisi sebelum menjalankan seed.',
    );
  }

  for (const departmentSeed of departments) {
    const department = await prisma.department.findUniqueOrThrow({
      where: { name: departmentSeed.name },
    });
    const managerDemoAccount = demoAccounts.find(
      (account) =>
        account.role === 'MANAJER' &&
        account.department === departmentSeed.name,
    );

    if (!managerDemoAccount) {
      throw new Error(
        `Konfigurasi akun manager ${departmentSeed.name} tidak tersedia.`,
      );
    }

    await prisma.user.upsert({
      where: { email: managerDemoAccount.email },
      update: {
        departmentId: department.id,
        roleId: managerRole.id,
        accountStatus: AccountStatus.AKTIF,
      },
      create: {
        departmentId: department.id,
        roleId: managerRole.id,
        employeeNumber: `MGR-${departmentSeed.code}-001`,
        name: `Manager ${departmentSeed.name}`,
        email: managerDemoAccount.email,
        passwordHash: hashPassword(managerPassword),
        accountStatus: AccountStatus.AKTIF,
      },
    });
  }

  if (isDemoModeEnabled()) {
    const itDepartment = await prisma.department.findUniqueOrThrow({
      where: { name: 'Information Technology' },
    });
    const staffDemoAccount = demoAccounts.find(
      (account) => account.persona === 'IT_STAFF',
    );
    const demoPassword =
      process.env.SEED_DEMO_PASSWORD?.trim() || managerPassword;

    if (!staffDemoAccount) {
      throw new Error('Konfigurasi akun demo staf IT tidak tersedia.');
    }

    await prisma.user.upsert({
      where: { email: staffDemoAccount.email },
      update: {
        departmentId: itDepartment.id,
        roleId: staffRole.id,
        accountStatus: AccountStatus.AKTIF,
      },
      create: {
        departmentId: itDepartment.id,
        roleId: staffRole.id,
        employeeNumber: 'STF-IT-001',
        name: 'Staf Demo IT',
        email: staffDemoAccount.email,
        passwordHash: hashPassword(demoPassword),
        accountStatus: AccountStatus.AKTIF,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
