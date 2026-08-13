import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveType,
  Prisma,
  RequestStatus,
  RequestType,
} from '../generated/prisma/client';
import { ApprovalService } from '../approval/approval.service';
import { NotificationService } from '../common/notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveNumber } from '../users/utils/parse-positive-number';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { LeaveBalanceService } from './leave-balance.service';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveBalanceService: LeaveBalanceService,
    private readonly approvalService: ApprovalService,
    private readonly notificationService: NotificationService,
  ) {}

  getBalance(userId: number, yearValue?: string) {
    const year = yearValue ? Number(yearValue) : new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1) {
      throw new BadRequestException('Tahun saldo cuti tidak valid.');
    }

    return this.leaveBalanceService.getBalance(userId, year);
  }

  async create(userId: number, dto: CreateLeaveDto) {
    const leaveType = this.parseLeaveType(dto.leaveType);
    const startDate = this.parseDate(dto.startDate, 'Tanggal mulai');
    const endDate = this.parseDate(dto.endDate, 'Tanggal selesai');
    const reason = dto.reason?.trim();

    if (endDate < startDate) {
      throw new BadRequestException(
        'Tanggal selesai tidak boleh sebelum tanggal mulai.',
      );
    }

    const minimumStartDate = this.getMinimumStartDate(leaveType);
    if (startDate < minimumStartDate) {
      throw new BadRequestException(
        leaveType === LeaveType.TAHUNAN
          ? 'Cuti tahunan harus diajukan minimal 3 hari sebelum tanggal mulai.'
          : 'Cuti khusus tidak dapat diajukan untuk tanggal sebelum hari ini.',
      );
    }

    if (!reason) {
      throw new BadRequestException('Alasan cuti wajib diisi.');
    }

    const totalDays = this.countDays(startDate, endDate);
    const request = await this.prisma.$transaction(async (transaction) => {
      if (leaveType === LeaveType.TAHUNAN) {
        await this.leaveBalanceService.reserve(
          userId,
          startDate.getUTCFullYear(),
          totalDays,
          transaction,
        );
      }

      const createdRequest = await transaction.request.create({
        data: {
          requesterId: userId,
          type: RequestType.CUTI,
          leaveRequest: {
            create: {
              leaveType,
              startDate,
              endDate,
              reason,
            },
          },
        },
        select: { id: true },
      });
      const approvalResult = await this.approvalService.generateForRequest(
        createdRequest.id,
        userId,
        transaction,
      );

      if (
        approvalResult.autoApproved &&
        leaveType === LeaveType.TAHUNAN
      ) {
        await this.leaveBalanceService.commit(
          userId,
          startDate.getUTCFullYear(),
          totalDays,
          transaction,
        );
      }

      return transaction.request.findUniqueOrThrow({
        where: { id: createdRequest.id },
        include: {
          leaveRequest: true,
          attachments: true,
          approvals: {
            include: {
              approver: { include: { role: true, department: true } },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    });

    await this.notificationService.notifyNewRequest(request.id);

    return {
      message: 'Pengajuan cuti berhasil dibuat.',
      request: this.toRequestResponse(request),
    };
  }

  listOwnRequests(userId: number, query: ListRequestsQueryDto) {
    return this.listRequests(userId, query);
  }

  listOwnLeaveRequests(userId: number, query: ListRequestsQueryDto) {
    return this.listRequests(userId, query, RequestType.CUTI);
  }

  async getOwnLeaveRequest(userId: number, requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        type: RequestType.CUTI,
        OR: [
          { requesterId: userId },
          { approvals: { some: { approverId: userId } } },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: { select: { name: true } },
          },
        },
        leaveRequest: true,
        attachments: true,
        approvals: {
          include: {
            approver: { include: { role: true, department: true } },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!request?.leaveRequest) {
      throw new NotFoundException('Pengajuan cuti tidak ditemukan.');
    }

    return this.toRequestResponse(request);
  }

  async cancel(userId: number, requestId: number) {
    const request = await this.prisma.$transaction(async (transaction) => {
      const currentRequest = await transaction.request.findFirst({
        where: {
          id: requestId,
          requesterId: userId,
          type: RequestType.CUTI,
        },
        include: { leaveRequest: true },
      });

      if (!currentRequest?.leaveRequest) {
        throw new NotFoundException('Pengajuan cuti tidak ditemukan.');
      }

      if (currentRequest.status !== RequestStatus.MENUNGGU) {
        throw new BadRequestException(
          'Pengajuan yang sudah final tidak dapat dibatalkan.',
        );
      }

      if (currentRequest.leaveRequest.leaveType === LeaveType.TAHUNAN) {
        await this.leaveBalanceService.restore(
          userId,
          currentRequest.leaveRequest.startDate.getUTCFullYear(),
          this.countDays(
            currentRequest.leaveRequest.startDate,
            currentRequest.leaveRequest.endDate,
          ),
          transaction,
        );
      }

      return transaction.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.DIBATALKAN,
          completedAt: new Date(),
        },
        include: {
          leaveRequest: true,
          attachments: true,
          approvals: {
            include: {
              approver: { include: { role: true, department: true } },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    });

    return {
      message: 'Pengajuan cuti berhasil dibatalkan.',
      request: this.toRequestResponse(request),
    };
  }

  private async listRequests(
    userId: number,
    query: ListRequestsQueryDto,
    fixedType?: RequestType,
  ) {
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const type = fixedType ?? this.parseRequestType(query.type);
    const status = this.parseRequestStatus(query.status);
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.RequestWhereInput = {
      requesterId: userId,
      NOT: {
        approvals: {
          some: { approverId: userId },
        },
      },
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: {
          leaveRequest: true,
          permissionRequest: true,
          reimbursementRequest: true,
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      data: requests.map((request) => this.toRequestResponse(request)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private parseLeaveType(value: string) {
    if (value === LeaveType.TAHUNAN || value === LeaveType.KHUSUS) {
      return value;
    }

    throw new BadRequestException(
      'Tipe cuti hanya boleh TAHUNAN atau KHUSUS.',
    );
  }

  private parseRequestType(value?: string) {
    if (!value) return undefined;
    if (Object.values(RequestType).includes(value as RequestType)) {
      return value as RequestType;
    }
    throw new BadRequestException('Jenis pengajuan tidak valid.');
  }

  private parseRequestStatus(value?: string) {
    if (!value) return undefined;
    if (Object.values(RequestStatus).includes(value as RequestStatus)) {
      return value as RequestStatus;
    }
    throw new BadRequestException('Status pengajuan tidak valid.');
  }

  private parseDate(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} tidak valid.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${label} tidak valid.`);
    }

    return date;
  }

  private countDays(startDate: Date, endDate: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;
  }

  private getMinimumStartDate(leaveType: LeaveType) {
    const todayInJakarta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const minimumDate = this.parseDate(todayInJakarta, 'Tanggal mulai');

    if (leaveType === LeaveType.TAHUNAN) {
      minimumDate.setUTCDate(minimumDate.getUTCDate() + 3);
    }

    return minimumDate;
  }

  private toRequestResponse(request: {
    id: number;
    requesterId: number;
    type: RequestType;
    status: RequestStatus;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    requester?: {
      id: number;
      name: string;
      employeeNumber: string;
      department: { name: string };
    };
    leaveRequest?: {
      id: number;
      requestId: number;
      leaveType: LeaveType;
      startDate: Date;
      endDate: Date;
      reason: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    permissionRequest?: unknown;
    reimbursementRequest?: unknown;
    attachments?: Array<{
      id: number;
      requestId: number | null;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      sizeByte: number;
      createdAt: Date;
    }>;
    approvals?: Array<{
      id: number;
      stepOrder: number;
      status: string;
      reviewNote: string | null;
      reviewedAt: Date | null;
      approver: {
        id: number;
        name: string;
        role: { name: string };
        department: { name: string };
      };
    }>;
  }) {
    return {
      ...request,
      totalDays: request.leaveRequest
        ? this.countDays(
            request.leaveRequest.startDate,
            request.leaveRequest.endDate,
          )
        : undefined,
    };
  }
}
