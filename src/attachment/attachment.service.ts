import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloudflareR2Service } from '../common/integrations/cloudflare-r2.service';
import {
  AttachmentType,
  RoleName,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestAttachmentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflareR2Service: CloudflareR2Service,
  ) {}

  async uploadRequestAttachment(
    userId: number,
    requestId: number,
    file?: RequestAttachmentFile,
  ) {
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, requesterId: userId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException('Pengajuan tidak ditemukan.');
    }

    if (!file) {
      throw new BadRequestException('Lampiran wajib dipilih.');
    }

    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.mimetype];

    if (!extension) {
      throw new BadRequestException(
        'Format lampiran harus berupa PDF, JPEG, PNG, atau WebP.',
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Ukuran setiap lampiran maksimal 2 MB.');
    }

    const attachmentCount = await this.prisma.attachmentFile.count({
      where: { requestId },
    });

    if (attachmentCount >= 3) {
      throw new BadRequestException(
        'Setiap pengajuan hanya dapat memiliki maksimal 3 lampiran.',
      );
    }

    const baseName = file.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'lampiran';
    const objectKey = `users/${userId}/requests/${requestId}/${Date.now()}-${baseName}.${extension}`;
    const fileUrl = await this.cloudflareR2Service.uploadObject(
      objectKey,
      file.buffer,
      file.mimetype,
    );
    const attachment = await this.prisma.attachmentFile.create({
      data: {
        requestId,
        cdnPublicId: objectKey,
        fileUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeByte: file.size,
        attachmentType: AttachmentType.PENGAJUAN,
      },
    });

    return {
      message: 'Lampiran berhasil diunggah.',
      attachment,
    };
  }

  async getRequestAttachment(
    userId: number,
    requestId: number,
    attachmentId: number,
  ) {
    const [attachment, user] = await this.prisma.$transaction([
      this.prisma.attachmentFile.findFirst({
        where: { id: attachmentId, requestId },
        include: {
          request: {
            select: {
              requesterId: true,
              approvals: {
                where: { approverId: userId },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, department: true },
      }),
    ]);

    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan.');
    }

    const isOwner = attachment.request?.requesterId === userId;
    const isApprover = Boolean(attachment.request?.approvals.length);
    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';

    if (!isOwner && !isApprover && !isHrManager) {
      throw new ForbiddenException('Anda tidak dapat melihat lampiran ini.');
    }

    const object = await this.cloudflareR2Service.getObject(
      attachment.fileUrl,
    );

    return {
      ...object,
      fileName: attachment.fileName,
    };
  }

  async uploadComplaintAttachment(
    userId: number,
    complaintId: number,
    file?: RequestAttachmentFile,
  ) {
    const [complaint, user] = await this.prisma.$transaction([
      this.prisma.complaint.findFirst({
        where: { id: complaintId, reporterId: userId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, department: true },
      }),
    ]);

    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';

    if (isHrManager) {
      throw new ForbiddenException(
        'HR Manager hanya dapat menangani keluhan karyawan.',
      );
    }

    if (!complaint) {
      throw new NotFoundException('Keluhan tidak ditemukan.');
    }

    if (!file) {
      throw new BadRequestException('Lampiran wajib dipilih.');
    }

    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.mimetype];

    if (!extension) {
      throw new BadRequestException(
        'Format lampiran harus berupa PDF, JPEG, PNG, atau WebP.',
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Ukuran setiap lampiran maksimal 2 MB.');
    }

    const attachmentCount = await this.prisma.attachmentFile.count({
      where: { complaintId },
    });

    if (attachmentCount >= 3) {
      throw new BadRequestException(
        'Setiap keluhan hanya dapat memiliki maksimal 3 lampiran.',
      );
    }

    const baseName =
      file.originalname
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'lampiran';
    const objectKey = `users/${userId}/complaints/${complaintId}/${Date.now()}-${baseName}.${extension}`;
    const fileUrl = await this.cloudflareR2Service.uploadObject(
      objectKey,
      file.buffer,
      file.mimetype,
    );
    const attachment = await this.prisma.attachmentFile.create({
      data: {
        complaintId,
        cdnPublicId: objectKey,
        fileUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeByte: file.size,
        attachmentType: AttachmentType.KELUHAN,
      },
    });

    return {
      message: 'Lampiran keluhan berhasil diunggah.',
      attachment,
    };
  }

  async getComplaintAttachment(
    userId: number,
    complaintId: number,
    attachmentId: number,
  ) {
    const [attachment, user] = await this.prisma.$transaction([
      this.prisma.attachmentFile.findFirst({
        where: { id: attachmentId, complaintId },
        include: {
          complaint: {
            select: { reporterId: true },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, department: true },
      }),
    ]);

    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan.');
    }

    const isOwner = attachment.complaint?.reporterId === userId;
    const isHrManager =
      user?.role.name === RoleName.MANAJER &&
      user.department.name === 'Human Resources';

    if (!isOwner && !isHrManager) {
      throw new ForbiddenException('Anda tidak dapat melihat lampiran ini.');
    }

    const object = await this.cloudflareR2Service.getObject(attachment.fileUrl);

    return {
      ...object,
      fileName: attachment.fileName,
    };
  }
}
