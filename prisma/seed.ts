import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  AccountStatus,
  PrismaClient,
  RoleName,
} from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL wajib diisi.');
}

const databaseUrl = new URL(connectionString);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: 5,
});
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

  const managerRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.MANAJER },
  });
  const managerPassword = process.env.SEED_MANAGER_PASSWORD;

  if (!managerPassword) {
    throw new Error('SEED_MANAGER_PASSWORD wajib diisi sebelum menjalankan seed.');
  }

  for (const departmentSeed of departments) {
    const department = await prisma.department.findUniqueOrThrow({
      where: { name: departmentSeed.name },
    });
    const existingManager = await prisma.user.findFirst({
      where: {
        departmentId: department.id,
        roleId: managerRole.id,
      },
    });

    if (!existingManager) {
      await prisma.user.create({
        data: {
          departmentId: department.id,
          roleId: managerRole.id,
          employeeNumber: `MGR-${departmentSeed.code}-001`,
          name: `Manager ${departmentSeed.name}`,
          email: `manager.${departmentSeed.code.toLowerCase()}@lakarya.local`,
          passwordHash: hashPassword(managerPassword),
          accountStatus: AccountStatus.AKTIF,
        },
      });
    }
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
