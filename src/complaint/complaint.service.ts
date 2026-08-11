import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintCategory,
  ComplaintStatus,
  Prisma,
  RoleName,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveNumber } from '../users/utils/parse-positive-number';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { ManageComplaintsQueryDto } from './dto/manage-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

const complaintInclude = {
  reporter: { include: { role: true, department: true } },
  handler: { include: { role: true, department: true } },
  attachments: true,
};

@Injectable()
export class ComplaintService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateComplaintDto) {
    await this.ensureCanUseOwnComplaints(userId);
    const subject = dto.subject?.trim();
    const description = dto.description?.trim();
    const category = this.parseCategory(dto.category);

    if (!subject) {
      throw new BadRequestException('Subjek keluhan wajib diisi.');
    }
    if (subject.length > 191) {
      throw new BadRequestException('Subjek keluhan maksimal 191 karakter.');
    }
    if (!description) {
      throw new BadRequestException('Deskripsi keluhan wajib diisi.');
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        reporterId: userId,
        subject,
        category,
        description,
      },
      include: complaintInclude,
    });

    return {
      message: 'Keluhan berhasil dibuat.',
      complaint,
    };
  }

  async listOwn(userId: number, query: ListComplaintsQueryDto) {
    await this.ensureCanUseOwnComplaints(userId);
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const where: Prisma.ComplaintWhereInput = { reporterId: userId };
    const [complaints, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return this.paginated(complaints, page, limit, total);
  }

  async getOwn(userId: number, complaintId: number) {
    await this.ensureCanUseOwnComplaints(userId);
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, reporterId: userId },
      include: complaintInclude,
    });

    if (!complaint) {
      throw new NotFoundException('Keluhan tidak ditemukan.');
    }
    return complaint;
  }

  async reopen(userId: number, complaintId: number) {
    await this.ensureCanUseOwnComplaints(userId);
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, reporterId: userId },
    });

    if (!complaint) {
      throw new NotFoundException('Keluhan tidak ditemukan.');
    }
    if (complaint.status !== ComplaintStatus.SELESAI) {
      throw new BadRequestException(
        'Hanya keluhan berstatus SELESAI yang dapat diproses kembali.',
      );
    }

    const reopened = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { status: ComplaintStatus.DIPROSES },
      include: complaintInclude,
    });

    return {
      message: 'Keluhan berhasil diajukan untuk diproses kembali.',
      complaint: reopened,
    };
  }

  async listManaged(userId: number, query: ManageComplaintsQueryDto) {
    await this.ensureHrManager(userId);
    const page = parsePositiveNumber(query.page, 1);
    const limit = parsePositiveNumber(query.limit, 10);
    const category = this.parseOptionalCategory(query.category);
    const status = this.parseOptionalStatus(query.status);
    const search = query.search?.trim();
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where: Prisma.ComplaintWhereInput = {
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(search ? { subject: { contains: search } } : {}),
    };

    const [complaints, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        include: {
          reporter: { include: { role: true, department: true } },
          handler: true,
        },
        orderBy: { createdAt: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return this.paginated(complaints, page, limit, total);
  }

  async getManaged(userId: number, complaintId: number) {
    await this.ensureHrManager(userId);
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: complaintInclude,
    });
    if (!complaint) {
      throw new NotFoundException('Keluhan tidak ditemukan.');
    }
    return complaint;
  }

  async updateManaged(
    userId: number,
    complaintId: number,
    dto: UpdateComplaintDto,
  ) {
    await this.ensureHrManager(userId);
    if (dto.status === undefined && dto.resolutionNote === undefined) {
      throw new BadRequestException('Tidak ada perubahan keluhan yang dikirim.');
    }

    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });
    if (!complaint) {
      throw new NotFoundException('Keluhan tidak ditemukan.');
    }

    const nextStatus = dto.status
      ? this.parseStatus(dto.status)
      : complaint.status;
    if (nextStatus !== complaint.status) {
      this.ensureValidTransition(complaint.status, nextStatus);
    }

    const startsProcessing =
      nextStatus === ComplaintStatus.DIPROSES &&
      complaint.status !== ComplaintStatus.DIPROSES;
    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: nextStatus,
        ...(dto.resolutionNote !== undefined
          ? { resolutionNote: dto.resolutionNote.trim() || null }
          : {}),
        ...(startsProcessing
          ? { handlerId: userId, reviewedAt: new Date() }
          : {}),
      },
      include: complaintInclude,
    });

    return {
      message: 'Keluhan berhasil diperbarui.',
      complaint: updated,
    };
  }

  private ensureValidTransition(
    current: ComplaintStatus,
    next: ComplaintStatus,
  ) {
    const allowed: Record<ComplaintStatus, ComplaintStatus[]> = {
      TERBUKA: [ComplaintStatus.DIPROSES],
      DIPROSES: [ComplaintStatus.SELESAI],
      SELESAI: [ComplaintStatus.DIPROSES, ComplaintStatus.DITUTUP],
      DITUTUP: [],
    };
    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `Perubahan status ${current} ke ${next} tidak valid.`,
      );
    }
  }

  private parseCategory(value: string) {
    if (Object.values(ComplaintCategory).includes(value as ComplaintCategory)) {
      return value as ComplaintCategory;
    }
    throw new BadRequestException('Kategori keluhan tidak valid.');
  }

  private parseOptionalCategory(value?: string) {
    return value ? this.parseCategory(value) : undefined;
  }

  private parseStatus(value: string) {
    if (Object.values(ComplaintStatus).includes(value as ComplaintStatus)) {
      return value as ComplaintStatus;
    }
    throw new BadRequestException('Status keluhan tidak valid.');
  }

  private parseOptionalStatus(value?: string) {
    return value ? this.parseStatus(value) : undefined;
  }

  private async ensureCanUseOwnComplaints(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, department: true },
    });
    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';
    if (isHrManager) {
      throw new ForbiddenException(
        'HR Manager hanya dapat menangani keluhan karyawan.',
      );
    }
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
        'Hanya HR Manager yang dapat menangani keluhan.',
      );
    }
  }

  private paginated<T>(items: T[], page: number, limit: number, total: number) {
    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
