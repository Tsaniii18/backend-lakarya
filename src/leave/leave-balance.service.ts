import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ANNUAL_LEAVE_DAYS = 12;

@Injectable()
export class LeaveBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(
    employeeId: number,
    year: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    return client.leaveBalance.upsert({
      where: { employeeId_year: { employeeId, year } },
      update: {},
      create: {
        employeeId,
        year,
        totalDays: DEFAULT_ANNUAL_LEAVE_DAYS,
      },
    });
  }

  async getBalance(employeeId: number, year: number) {
    const balance = await this.findOrCreate(employeeId, year);
    return this.toResponse(balance);
  }

  async reserve(
    employeeId: number,
    year: number,
    totalDays: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const balance = await this.findOrCreate(employeeId, year, client);
    const availableDays =
      balance.totalDays - balance.reservedDays - balance.usedDays;

    if (availableDays < totalDays) {
      throw new BadRequestException(
        `Saldo cuti tahunan tidak cukup. Tersedia ${availableDays} hari.`,
      );
    }

    return client.leaveBalance.update({
      where: { id: balance.id },
      data: { reservedDays: { increment: totalDays } },
    });
  }

  async commit(
    employeeId: number,
    year: number,
    totalDays: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const result = await client.leaveBalance.updateMany({
      where: {
        employeeId,
        year,
        reservedDays: { gte: totalDays },
      },
      data: {
        reservedDays: { decrement: totalDays },
        usedDays: { increment: totalDays },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Saldo cuti tahunan tidak dapat diproses.');
    }
  }

  async restore(
    employeeId: number,
    year: number,
    totalDays: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const result = await client.leaveBalance.updateMany({
      where: {
        employeeId,
        year,
        reservedDays: { gte: totalDays },
      },
      data: { reservedDays: { decrement: totalDays } },
    });

    if (result.count === 0) {
      throw new ConflictException('Saldo cuti tahunan tidak dapat dipulihkan.');
    }
  }

  toResponse(balance: {
    id: number;
    employeeId: number;
    year: number;
    totalDays: number;
    reservedDays: number;
    usedDays: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...balance,
      availableDays:
        balance.totalDays - balance.reservedDays - balance.usedDays,
    };
  }
}
