import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PermissionType,
  Prisma,
  RequestStatus,
  RequestType,
} from '../generated/prisma/client';
import { ApprovalService } from '../approval/approval.service';
import { ListRequestsQueryDto } from '../leave/dto/list-requests-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveNumber } from '../users/utils/parse-positive-number';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
  ) {}

  async create(userId: number, dto: CreatePermissionDto) {
    const permissionType = this.parsePermissionType(dto.permissionType);
    const startDate = this.parseDate(dto.startDate, 'Tanggal mulai');
    const endDate = this.parseDate(dto.endDate, 'Tanggal selesai');
    const reason = dto.reason?.trim();

    if (startDate < this.getTodayInJakarta()) {
      throw new BadRequestException(
        'Pengajuan izin tidak dapat menggunakan tanggal sebelum hari ini.',
      );
    }

    if (!reason) {
      throw new BadRequestException('Alasan izin wajib diisi.');
    }

    let totalDays = 0;
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    if (permissionType === PermissionType.HARIAN) {
      if (endDate < startDate) {
        throw new BadRequestException(
          'Tanggal selesai tidak boleh sebelum tanggal mulai.',
        );
      }
      totalDays = this.countDays(startDate, endDate);
    } else {
      if (startDate.getTime() !== endDate.getTime()) {
        throw new BadRequestException(
          'Izin per jam hanya dapat diajukan untuk satu tanggal.',
        );
      }

      startTime = this.parseTime(dto.startTime, 'Waktu mulai');
      endTime = this.parseTime(dto.endTime, 'Waktu selesai');

      if (endTime <= startTime) {
        throw new BadRequestException(
          'Waktu selesai harus setelah waktu mulai.',
        );
      }
    }

    const request = await this.prisma.$transaction(async (transaction) => {
      const createdRequest = await transaction.request.create({
        data: {
          requesterId: userId,
          type: RequestType.IZIN,
          permissionRequest: {
            create: {
              permissionType,
              startDate,
              endDate,
              totalDays,
              startTime,
              endTime,
              reason,
            },
          },
        },
        select: { id: true },
      });
      await this.approvalService.generateForRequest(
        createdRequest.id,
        userId,
        transaction,
      );
      return transaction.request.findUniqueOrThrow({
        where: { id: createdRequest.id },
        include: {
          permissionRequest: true,
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
      message: 'Pengajuan izin berhasil dibuat.',
      request: this.toResponse(request),
    };
  }

  async listOwnPermissionRequests(
    userId: number,
    query: ListRequestsQueryDto,
  ) {
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const status = this.parseRequestStatus(query.status);
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.RequestWhereInput = {
      requesterId: userId,
      type: RequestType.IZIN,
      ...(status ? { status } : {}),
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: { permissionRequest: true },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      data: requests.map((request) => this.toResponse(request)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getOwnPermissionRequest(userId: number, requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        type: RequestType.IZIN,
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
        permissionRequest: true,
        attachments: true,
        approvals: {
          include: {
            approver: { include: { role: true, department: true } },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!request?.permissionRequest) {
      throw new NotFoundException('Pengajuan izin tidak ditemukan.');
    }

    return this.toResponse(request);
  }

  async cancel(userId: number, requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        requesterId: userId,
        type: RequestType.IZIN,
      },
      include: { permissionRequest: true },
    });

    if (!request?.permissionRequest) {
      throw new NotFoundException('Pengajuan izin tidak ditemukan.');
    }

    if (request.status !== RequestStatus.MENUNGGU) {
      throw new BadRequestException(
        'Pengajuan yang sudah final tidak dapat dibatalkan.',
      );
    }

    const canceledRequest = await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.DIBATALKAN,
        completedAt: new Date(),
      },
      include: {
        permissionRequest: true,
        attachments: true,
        approvals: {
          include: {
            approver: { include: { role: true, department: true } },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    return {
      message: 'Pengajuan izin berhasil dibatalkan.',
      request: this.toResponse(canceledRequest),
    };
  }

  private parsePermissionType(value: string) {
    if (value === PermissionType.HARIAN || value === PermissionType.JAM) {
      return value;
    }
    throw new BadRequestException(
      'Tipe izin hanya boleh HARIAN atau JAM.',
    );
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
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`${label} tidak valid.`);
    }

    return date;
  }

  private parseTime(value: string | undefined, label: string) {
    if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException(`${label} tidak valid.`);
    }
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private countDays(startDate: Date, endDate: Date) {
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  }

  private getTodayInJakarta() {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return this.parseDate(today, 'Tanggal izin');
  }

  private toResponse(request: {
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
    permissionRequest: {
      id: number;
      requestId: number;
      permissionType: PermissionType;
      startDate: Date;
      endDate: Date;
      totalDays: Prisma.Decimal;
      startTime: Date | null;
      endTime: Date | null;
      reason: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
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
      permissionRequest: request.permissionRequest
        ? {
            ...request.permissionRequest,
            totalDays: Number(request.permissionRequest.totalDays),
          }
        : null,
    };
  }
}
