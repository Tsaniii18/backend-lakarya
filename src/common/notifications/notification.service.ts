import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalStatus,
  RequestType,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResendService } from '../integrations/resend.service';
import { isDemoAccountEmail } from '../demo-accounts';
import { createNotificationEmail } from './notification-email';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resendService: ResendService,
  ) {}

  async notifyNewRequest(requestId: number) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requester: { include: { role: true, department: true } },
        approvals: {
          where: { stepOrder: 1 },
          include: { approver: true },
          take: 1,
        },
      },
    });

    const approver = request?.approvals[0]?.approver;
    if (!request || !approver) return;

    await this.sendSafely({
      to: this.deliveryEmail(approver.email),
      subject: `Pengajuan baru ${this.requestLabel(request.type)} · REQ-${request.id}`,
      html: createNotificationEmail({
        eyebrow: 'Pengajuan Baru',
        title: `${this.requestLabel(request.type)} perlu ditinjau`,
        recipientName: approver.name,
        message: `${request.requester.name} mengajukan ${this.requestLabel(request.type).toLowerCase()} baru yang menunggu tinjauan Anda.`,
        details: [
          { label: 'Nomor', value: `REQ-${request.id}` },
          { label: 'Karyawan', value: request.requester.name },
          { label: 'Departemen', value: request.requester.department.name },
        ],
      }),
      text: `${request.requester.name} mengajukan ${this.requestLabel(request.type).toLowerCase()} baru dengan nomor REQ-${request.id} dan menunggu tinjauan Anda.`,
    });
  }

  async notifyNewComplaint(complaintId: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { reporter: { include: { department: true } } },
    });
    if (!complaint) return;

    const hrManagers = await this.prisma.user.findMany({
      where: {
        accountStatus: 'AKTIF',
        role: { name: 'MANAJER' },
        department: { name: 'Human Resources' },
      },
      select: { name: true, email: true },
    });

    await Promise.all(
      hrManagers.map((manager) =>
        this.sendSafely({
          to: this.deliveryEmail(manager.email),
          subject: `Keluhan baru · KLH-${complaint.id}`,
          html: createNotificationEmail({
            eyebrow: 'Keluhan Baru',
            title: 'Keluhan karyawan perlu ditangani',
            recipientName: manager.name,
            message: `${complaint.reporter.name} menyampaikan keluhan baru untuk ditindaklanjuti oleh HR.`,
            details: [
              { label: 'Nomor', value: `KLH-${complaint.id}` },
              { label: 'Pelapor', value: complaint.reporter.name },
              { label: 'Departemen', value: complaint.reporter.department.name },
              { label: 'Subjek', value: complaint.subject },
            ],
          }),
          text: `${complaint.reporter.name} menyampaikan keluhan baru dengan nomor KLH-${complaint.id}: ${complaint.subject}.`,
        }),
      ),
    );
  }

  async notifyApprovalReviewed(approvalId: number, decision: ApprovalStatus) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id: approvalId },
      include: {
        approver: true,
        request: {
          include: {
            requester: true,
            approvals: {
              include: { approver: true },
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!approval) return;

    const decisionLabel =
      decision === ApprovalStatus.DISETUJUI ? 'disetujui' : 'ditolak';
    await this.sendSafely({
      to: this.deliveryEmail(approval.request.requester.email),
      subject: `Tinjauan REQ-${approval.requestId}: ${decisionLabel === 'disetujui' ? 'Disetujui' : 'Ditolak'}`,
      html: createNotificationEmail({
        eyebrow: 'Hasil Tinjauan',
        title: `Tahap pengajuan Anda ${decisionLabel}`,
        recipientName: approval.request.requester.name,
        message: `${approval.approver.name} telah ${decisionLabel === 'disetujui' ? 'menyetujui' : 'menolak'} tahap persetujuan pengajuan Anda.`,
        details: [
          { label: 'Nomor', value: `REQ-${approval.requestId}` },
          { label: 'Jenis', value: this.requestLabel(approval.request.type) },
          { label: 'Peninjau', value: approval.approver.name },
          { label: 'Keputusan', value: decisionLabel === 'disetujui' ? 'Disetujui' : 'Ditolak' },
          ...(approval.reviewNote
            ? [{ label: 'Catatan', value: approval.reviewNote }]
            : []),
        ],
      }),
      text: `Tahap persetujuan ${this.requestLabel(approval.request.type).toLowerCase()} REQ-${approval.requestId} telah ${decisionLabel} oleh ${approval.approver.name}.${approval.reviewNote ? ` Catatan: ${approval.reviewNote}` : ''}`,
    });

    if (decision !== ApprovalStatus.DISETUJUI) return;
    const nextApproval = approval.request.approvals.find(
      (item) =>
        item.stepOrder > approval.stepOrder &&
        item.status === ApprovalStatus.MENUNGGU,
    );
    if (!nextApproval) return;

    await this.sendSafely({
      to: this.deliveryEmail(nextApproval.approver.email),
      subject: `Pengajuan menunggu tinjauan Anda · REQ-${approval.requestId}`,
      html: createNotificationEmail({
        eyebrow: 'Tinjauan Berikutnya',
        title: 'Pengajuan perlu ditinjau',
        recipientName: nextApproval.approver.name,
        message: `Tahap sebelumnya telah disetujui dan pengajuan ${approval.request.requester.name} kini menunggu tinjauan Anda.`,
        details: [
          { label: 'Nomor', value: `REQ-${approval.requestId}` },
          { label: 'Jenis', value: this.requestLabel(approval.request.type) },
          { label: 'Karyawan', value: approval.request.requester.name },
        ],
      }),
      text: `Pengajuan REQ-${approval.requestId} dari ${approval.request.requester.name} kini menunggu tinjauan Anda.`,
    });
  }

  private requestLabel(type: RequestType) {
    if (type === RequestType.CUTI) return 'Cuti';
    if (type === RequestType.IZIN) return 'Izin';
    return 'Reimbursement';
  }

  private deliveryEmail(email: string) {
    if (!isDemoAccountEmail(email)) return email;
    return process.env.DEMO_NOTIFICATION_EMAIL?.trim() || email;
  }

  private async sendSafely(email: Parameters<ResendService['sendEmail']>[0]) {
    try {
      await this.resendService.sendEmail(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Notifikasi email gagal dikirim: ${message}`);
    }
  }
}
