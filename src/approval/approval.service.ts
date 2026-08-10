import {
  AccountStatus,
  ApprovalStatus,
  LeaveType,
  PermissionType,
  Prisma,
  RequestStatus,
  RequestType,
  RoleName,
} from '../generated/prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveNumber } from '../users/utils/parse-positive-number';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';
import { ManageRequestsQueryDto } from './dto/manage-requests-query.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForRequest(
    requestId: number,
    requesterId: number,
    client: Prisma.TransactionClient,
  ) {
    const requester = await client.user.findUnique({
      where: { id: requesterId },
      include: { role: true, department: true },
    });

    if (!requester) {
      throw new NotFoundException('User pengaju tidak ditemukan.');
    }

    const isHrManager =
      requester.role.name === RoleName.MANAJER &&
      requester.department.name === 'Human Resources';

    if (isHrManager) {
      await client.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.DISETUJUI,
          completedAt: new Date(),
        },
      });
      return { autoApproved: true };
    }

    const hrManager = await this.findSingleManager(
      client,
      undefined,
      'Human Resources',
    );
    const approverIds: number[] = [];

    if (
      requester.role.name === RoleName.STAF &&
      requester.department.name !== 'Human Resources'
    ) {
      const directManager = await this.findSingleManager(
        client,
        requester.departmentId,
      );
      approverIds.push(directManager.id);
    }

    if (!approverIds.includes(hrManager.id)) {
      approverIds.push(hrManager.id);
    }

    await client.requestApproval.createMany({
      data: approverIds.map((approverId, index) => ({
        requestId,
        approverId,
        stepOrder: index + 1,
      })),
    });

    return { autoApproved: false };
  }

  async listInbox(userId: number, query: ListApprovalsQueryDto) {
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const status = this.parseApprovalStatus(query.status);
    const actionablePending: Prisma.RequestApprovalWhereInput = {
      request: { status: RequestStatus.MENUNGGU },
      OR: [
        { stepOrder: 1 },
        {
          stepOrder: 2,
          request: {
            approvals: {
              some: {
                stepOrder: 1,
                status: ApprovalStatus.DISETUJUI,
              },
            },
          },
        },
      ],
    };
    const where: Prisma.RequestApprovalWhereInput = {
      approverId: userId,
      ...(status ? { status } : {}),
      ...(status === ApprovalStatus.MENUNGGU
        ? { AND: [actionablePending] }
        : !status
          ? {
              AND: [
                {
                  OR: [
                    { status: { not: ApprovalStatus.MENUNGGU } },
                    {
                      status: ApprovalStatus.MENUNGGU,
                      AND: [actionablePending],
                    },
                  ],
                },
              ],
            }
          : {}),
    };

    const [approvals, total] = await this.prisma.$transaction([
      this.prisma.requestApproval.findMany({
        where,
        include: {
          request: {
            include: {
              requester: { include: { role: true, department: true } },
              leaveRequest: true,
              permissionRequest: true,
              approvals: {
                include: {
                  approver: { include: { role: true, department: true } },
                },
                orderBy: { stepOrder: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.requestApproval.count({ where }),
    ]);

    return {
      data: approvals.map((approval) => this.withCanProcess(approval)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getInboxDetail(userId: number, approvalId: number) {
    const approval = await this.prisma.requestApproval.findFirst({
      where: { id: approvalId, approverId: userId },
      include: {
        request: {
          include: {
            requester: { include: { role: true, department: true } },
            leaveRequest: true,
            permissionRequest: true,
            attachments: true,
            approvals: {
              include: {
                approver: { include: { role: true, department: true } },
              },
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException('Persetujuan tidak ditemukan.');
    }

    return this.withCanProcess(approval);
  }

  approve(userId: number, approvalId: number, dto: ReviewApprovalDto) {
    return this.review(userId, approvalId, ApprovalStatus.DISETUJUI, dto);
  }

  reject(userId: number, approvalId: number, dto: ReviewApprovalDto) {
    return this.review(userId, approvalId, ApprovalStatus.DITOLAK, dto);
  }

  async listManagedRequests(userId: number, query: ManageRequestsQueryDto) {
    await this.ensureHrManager(userId);
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const type = this.parseManageRequestType(query.type);
    const status = this.parseRequestStatus(query.status);
    const subtype = this.parseSubtype(query.subtype);
    const department = query.department?.trim();
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.RequestWhereInput = {
      type: type ?? { in: [RequestType.CUTI, RequestType.IZIN] },
      ...(status ? { status } : {}),
      ...(department ? { requester: { department: { name: department } } } : {}),
      ...(subtype === LeaveType.TAHUNAN || subtype === LeaveType.KHUSUS
        ? { leaveRequest: { leaveType: subtype } }
        : {}),
      ...(subtype === PermissionType.HARIAN || subtype === PermissionType.JAM
        ? { permissionRequest: { permissionType: subtype } }
        : {}),
    };

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: {
          requester: { include: { role: true, department: true } },
          leaveRequest: true,
          permissionRequest: true,
          approvals: {
            include: {
              approver: { include: { role: true, department: true } },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.request.count({ where }),
    ]);

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

  async getManagedRequest(userId: number, requestId: number) {
    await this.ensureHrManager(userId);
    const request = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        type: { in: [RequestType.CUTI, RequestType.IZIN] },
      },
      include: {
        requester: { include: { role: true, department: true } },
        leaveRequest: true,
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

    if (!request) {
      throw new NotFoundException('Pengajuan tidak ditemukan.');
    }

    return request;
  }

  private async review(
    userId: number,
    approvalId: number,
    decision: ApprovalStatus,
    dto: ReviewApprovalDto,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const approval = await transaction.requestApproval.findFirst({
        where: { id: approvalId, approverId: userId },
        include: {
          approver: { select: { accountStatus: true } },
          request: {
            include: {
              leaveRequest: true,
              approvals: { orderBy: { stepOrder: 'asc' } },
            },
          },
        },
      });

      if (!approval) {
        throw new NotFoundException('Persetujuan tidak ditemukan.');
      }
      if (approval.approver.accountStatus !== AccountStatus.AKTIF) {
        throw new ForbiddenException(
          'Approver yang tidak aktif tidak dapat memproses pengajuan.',
        );
      }
      if (
        approval.status !== ApprovalStatus.MENUNGGU ||
        approval.request.status !== RequestStatus.MENUNGGU
      ) {
        throw new BadRequestException(
          'Persetujuan yang sudah final tidak dapat diproses ulang.',
        );
      }

      const previousApprovals = approval.request.approvals.filter(
        (item) => item.stepOrder < approval.stepOrder,
      );
      if (
        previousApprovals.some(
          (item) => item.status !== ApprovalStatus.DISETUJUI,
        )
      ) {
        throw new ForbiddenException(
          'Tahap persetujuan sebelumnya belum disetujui.',
        );
      }

      await transaction.requestApproval.update({
        where: { id: approvalId },
        data: {
          status: decision,
          reviewNote: dto.reviewNote?.trim() || null,
          reviewedAt: new Date(),
        },
      });

      if (decision === ApprovalStatus.DITOLAK) {
        await transaction.request.update({
          where: { id: approval.requestId },
          data: { status: RequestStatus.DITOLAK, completedAt: new Date() },
        });
        await this.restoreAnnualLeave(approval.request, transaction);
        return;
      }

      const hasNextApproval = approval.request.approvals.some(
        (item) => item.stepOrder > approval.stepOrder,
      );
      if (!hasNextApproval) {
        await transaction.request.update({
          where: { id: approval.requestId },
          data: { status: RequestStatus.DISETUJUI, completedAt: new Date() },
        });
        await this.commitAnnualLeave(approval.request, transaction);
      }
    });

    return {
      message:
        decision === ApprovalStatus.DISETUJUI
          ? 'Pengajuan berhasil disetujui.'
          : 'Pengajuan berhasil ditolak.',
      approval: await this.getInboxDetail(userId, approvalId),
    };
  }

  private async commitAnnualLeave(
    request: {
      requesterId: number;
      leaveRequest: {
        leaveType: LeaveType;
        startDate: Date;
        endDate: Date;
      } | null;
    },
    client: Prisma.TransactionClient,
  ) {
    if (request.leaveRequest?.leaveType !== LeaveType.TAHUNAN) return;
    const totalDays = this.countDays(
      request.leaveRequest.startDate,
      request.leaveRequest.endDate,
    );
    const result = await client.leaveBalance.updateMany({
      where: {
        employeeId: request.requesterId,
        year: request.leaveRequest.startDate.getUTCFullYear(),
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

  private async restoreAnnualLeave(
    request: {
      requesterId: number;
      leaveRequest: {
        leaveType: LeaveType;
        startDate: Date;
        endDate: Date;
      } | null;
    },
    client: Prisma.TransactionClient,
  ) {
    if (request.leaveRequest?.leaveType !== LeaveType.TAHUNAN) return;
    const totalDays = this.countDays(
      request.leaveRequest.startDate,
      request.leaveRequest.endDate,
    );
    const result = await client.leaveBalance.updateMany({
      where: {
        employeeId: request.requesterId,
        year: request.leaveRequest.startDate.getUTCFullYear(),
        reservedDays: { gte: totalDays },
      },
      data: { reservedDays: { decrement: totalDays } },
    });
    if (result.count === 0) {
      throw new ConflictException('Saldo cuti tahunan tidak dapat dipulihkan.');
    }
  }

  private async findSingleManager(
    client: Prisma.TransactionClient,
    departmentId?: number,
    departmentName?: string,
  ) {
    const managers = await client.user.findMany({
      where: {
        accountStatus: AccountStatus.AKTIF,
        role: { name: RoleName.MANAJER },
        ...(departmentId ? { departmentId } : {}),
        ...(departmentName ? { department: { name: departmentName } } : {}),
      },
      take: 2,
    });

    if (managers.length !== 1) {
      throw new BadRequestException(
        'Manager aktif untuk proses persetujuan tidak tersedia atau tidak unik.',
      );
    }
    return managers[0];
  }

  private async ensureHrManager(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, department: true },
    });
    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';
    if (!isHrManager) {
      throw new ForbiddenException(
        'Hanya HR Manager yang dapat mengakses kelola pengajuan.',
      );
    }
  }

  private parseApprovalStatus(value?: string) {
    if (!value) return undefined;
    if (Object.values(ApprovalStatus).includes(value as ApprovalStatus)) {
      return value as ApprovalStatus;
    }
    throw new BadRequestException('Status persetujuan tidak valid.');
  }

  private parseRequestStatus(value?: string) {
    if (!value) return undefined;
    if (Object.values(RequestStatus).includes(value as RequestStatus)) {
      return value as RequestStatus;
    }
    throw new BadRequestException('Status pengajuan tidak valid.');
  }

  private parseManageRequestType(value?: string) {
    if (!value) return undefined;
    if (value === RequestType.CUTI || value === RequestType.IZIN) return value;
    throw new BadRequestException('Jenis pengajuan tidak valid.');
  }

  private parseSubtype(value?: string) {
    if (!value) return undefined;
    const allowed = [
      ...Object.values(LeaveType),
      ...Object.values(PermissionType),
    ];
    if (allowed.includes(value as LeaveType | PermissionType)) {
      return value as LeaveType | PermissionType;
    }
    throw new BadRequestException('Subtype pengajuan tidak valid.');
  }

  private countDays(startDate: Date, endDate: Date) {
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  }

  private withCanProcess<T extends {
    status: ApprovalStatus;
    stepOrder: number;
    request: {
      status: RequestStatus;
      approvals: Array<{ stepOrder: number; status: ApprovalStatus }>;
    };
  }>(approval: T) {
    const previousApproved = approval.request.approvals
      .filter((item) => item.stepOrder < approval.stepOrder)
      .every((item) => item.status === ApprovalStatus.DISETUJUI);
    return {
      ...approval,
      canProcess:
        approval.status === ApprovalStatus.MENUNGGU &&
        approval.request.status === RequestStatus.MENUNGGU &&
        previousApproved,
    };
  }
}
