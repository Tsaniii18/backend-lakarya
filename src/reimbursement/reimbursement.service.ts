import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalService } from '../approval/approval.service';
import { NotificationService } from '../common/notifications/notification.service';
import {
  ExpenseType,
  Prisma,
  RequestStatus,
  RequestType,
  RoleName,
} from '../generated/prisma/client';
import { ListRequestsQueryDto } from '../leave/dto/list-requests-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveNumber } from '../users/utils/parse-positive-number';
import { CreateReimbursementDto } from './dto/create-reimbursement.dto';
import { ManageReimbursementsQueryDto } from './dto/manage-reimbursements-query.dto';

const reimbursementInclude = {
  reimbursementRequest: true,
  attachments: true,
  approvals: {
    include: {
      approver: { include: { role: true, department: true } },
    },
    orderBy: { stepOrder: 'asc' as const },
  },
};

@Injectable()
export class ReimbursementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: number, dto: CreateReimbursementDto) {
    const expenseType = this.parseExpenseType(dto.expenseType);
    const expenseDate = this.parseDate(dto.expenseDate);
    const expenseAmount = Number(dto.expenseAmount);
    const description = dto.description?.trim();

    if (
      !Number.isFinite(expenseAmount) ||
      expenseAmount <= 0 ||
      expenseAmount > 999999999999.99 ||
      Math.abs(expenseAmount * 100 - Math.round(expenseAmount * 100)) > 1e-8
    ) {
      throw new BadRequestException(
        'Nominal harus lebih dari 0 dan maksimal memiliki 2 angka desimal.',
      );
    }

    if (!description) {
      throw new BadRequestException('Deskripsi biaya wajib diisi.');
    }

    const request = await this.prisma.$transaction(async (transaction) => {
      const createdRequest = await transaction.request.create({
        data: {
          requesterId: userId,
          type: RequestType.PENGGANTIAN_BIAYA,
          reimbursementRequest: {
            create: {
              expenseType,
              expenseDate,
              expenseAmount: new Prisma.Decimal(expenseAmount),
              description,
            },
          },
        },
        select: { id: true },
      });

      await this.approvalService.generateForReimbursement(
        createdRequest.id,
        userId,
        transaction,
      );

      return transaction.request.findUniqueOrThrow({
        where: { id: createdRequest.id },
        include: reimbursementInclude,
      });
    });

    await this.notificationService.notifyNewRequest(request.id);

    return {
      message: 'Pengajuan penggantian biaya berhasil dibuat.',
      request,
    };
  }

  async listOwn(userId: number, query: ListRequestsQueryDto) {
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const status = this.parseRequestStatus(query.status);
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.RequestWhereInput = {
      requesterId: userId,
      type: RequestType.PENGGANTIAN_BIAYA,
      ...(status ? { status } : {}),
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: { reimbursementRequest: true },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

    return this.toPaginatedResponse(requests, page, limit, total);
  }

  async getOwn(userId: number, requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        type: RequestType.PENGGANTIAN_BIAYA,
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
        ...reimbursementInclude,
      },
    });

    if (!request?.reimbursementRequest) {
      throw new NotFoundException('Pengajuan penggantian biaya tidak ditemukan.');
    }

    return request;
  }

  async cancel(userId: number, requestId: number) {
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        requesterId: userId,
        type: RequestType.PENGGANTIAN_BIAYA,
      },
      include: { reimbursementRequest: true },
    });

    if (!request?.reimbursementRequest) {
      throw new NotFoundException('Pengajuan penggantian biaya tidak ditemukan.');
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
      include: reimbursementInclude,
    });

    return {
      message: 'Pengajuan penggantian biaya berhasil dibatalkan.',
      request: canceledRequest,
    };
  }

  async listManaged(userId: number, query: ManageReimbursementsQueryDto) {
    await this.ensureFinanceManager(userId);
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const status = this.parseRequestStatus(query.status);
    const expenseType = this.parseOptionalExpenseType(query.expenseType);
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.RequestWhereInput = {
      type: RequestType.PENGGANTIAN_BIAYA,
      ...(status ? { status } : {}),
      ...(expenseType
        ? { reimbursementRequest: { expenseType } }
        : {}),
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: {
          requester: { include: { role: true, department: true } },
          ...reimbursementInclude,
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

    return this.toPaginatedResponse(requests, page, limit, total);
  }

  async getManaged(userId: number, requestId: number) {
    await this.ensureFinanceManager(userId);
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        type: RequestType.PENGGANTIAN_BIAYA,
      },
      include: {
        requester: { include: { role: true, department: true } },
        ...reimbursementInclude,
      },
    });

    if (!request?.reimbursementRequest) {
      throw new NotFoundException('Pengajuan penggantian biaya tidak ditemukan.');
    }

    return request;
  }

  private parseExpenseType(value: string) {
    if (Object.values(ExpenseType).includes(value as ExpenseType)) {
      return value as ExpenseType;
    }
    throw new BadRequestException('Tipe biaya tidak valid.');
  }

  private parseOptionalExpenseType(value?: string) {
    return value ? this.parseExpenseType(value) : undefined;
  }

  private parseRequestStatus(value?: string) {
    if (!value) return undefined;
    if (Object.values(RequestStatus).includes(value as RequestStatus)) {
      return value as RequestStatus;
    }
    throw new BadRequestException('Status pengajuan tidak valid.');
  }

  private parseDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Tanggal biaya tidak valid.');
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Tanggal biaya tidak valid.');
    }
    return date;
  }

  private async ensureFinanceManager(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, department: true },
    });
    const isFinanceManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Finance';

    if (!isFinanceManager) {
      throw new ForbiddenException(
        'Hanya Finance Manager yang dapat mengakses kelola reimbursement.',
      );
    }
  }

  private toPaginatedResponse<T>(
    requests: T[],
    page: number,
    limit: number,
    total: number,
  ) {
    return {
      data: requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
