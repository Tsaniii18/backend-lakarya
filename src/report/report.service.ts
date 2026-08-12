import {
  ComplaintCategory,
  ComplaintStatus,
  ExpenseType,
  LeaveType,
  PermissionType,
  RequestStatus,
  RequestType,
  RoleName,
} from '../generated/prisma/client';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { createCsv, createTablePdf } from './report-export.utils';

type ReportFormat = 'csv' | 'pdf';
type ReportDepartment = 'Human Resources' | 'Finance';

interface ReportQuery {
  month?: string;
  year?: string;
  format?: string;
}

interface ReportPeriod {
  month: number;
  year: number;
  start: Date;
  end: Date;
  format: ReportFormat;
  label: string;
  slug: string;
}

interface ReportFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

function loadLogoSvg() {
  const candidates = [
    resolve(__dirname, 'assets/logo.svg'),
    resolve(process.cwd(), 'src/report/assets/logo.svg'),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  return logoPath ? readFileSync(logoPath, 'utf8') : undefined;
}

const lakaryaLogoSvg = loadLogoSvg();

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportLeavePermission(userId: number, query: ReportQuery) {
    const manager = await this.ensureManager(userId, 'Human Resources');
    const period = this.parsePeriod(query);
    const requests = await this.prisma.request.findMany({
      where: {
        type: { in: [RequestType.CUTI, RequestType.IZIN] },
        status: { in: [RequestStatus.DISETUJUI, RequestStatus.DITOLAK] },
        OR: [
          {
            leaveRequest: {
              startDate: { lt: period.end },
              endDate: { gte: period.start },
            },
          },
          {
            permissionRequest: {
              startDate: { lt: period.end },
              endDate: { gte: period.start },
            },
          },
        ],
      },
      include: {
        requester: { include: { department: true } },
        leaveRequest: true,
        permissionRequest: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const rows = requests.map((request, index) => {
      const detail = request.leaveRequest ?? request.permissionRequest;
      const type = request.leaveRequest
        ? this.leaveTypeLabel(request.leaveRequest.leaveType)
        : this.permissionTypeLabel(request.permissionRequest!.permissionType);
      const duration = request.leaveRequest
        ? `${this.dayDifference(request.leaveRequest.startDate, request.leaveRequest.endDate)} hari`
        : request.permissionRequest!.permissionType === PermissionType.HARIAN
          ? `${Number(request.permissionRequest!.totalDays)} hari`
          : `${this.formatTime(request.permissionRequest!.startTime)} - ${this.formatTime(request.permissionRequest!.endTime)}`;
      return {
        number: index + 1,
        requestNumber: `REQ-${request.id}`,
        name: request.requester.name,
        employeeNumber: request.requester.employeeNumber,
        department: request.requester.department.name,
        type,
        startDate: this.formatDate(detail!.startDate),
        endDate: this.formatDate(detail!.endDate),
        duration,
        status: this.requestStatusLabel(request.status),
        note: detail!.reason,
        submittedAt: this.formatDate(request.createdAt),
      };
    });

    const leaveTotal = requests.filter((request) => request.type === RequestType.CUTI).length;
    const permissionTotal = requests.length - leaveTotal;
    const statusSummary = this.statusSummary(requests.map((request) => request.status));
    const summary = [
      `${requests.length} pengajuan terdiri dari ${leaveTotal} cuti dan ${permissionTotal} izin.`,
      statusSummary,
    ];

    if (period.format === 'csv') {
      return this.file(
        createCsv(
          ['No', 'Nomor Pengajuan', 'Nama Karyawan', 'No. Pegawai', 'Departemen', 'Jenis', 'Tanggal Mulai', 'Tanggal Selesai', 'Durasi', 'Status', 'Catatan', 'Tanggal Diajukan'],
          rows.map((row) => Object.values(row)),
        ),
        `laporan-cuti-izin-${period.slug}.csv`,
        'text/csv; charset=utf-8',
      );
    }

    return this.file(
      createTablePdf({
        title: 'Laporan Cuti dan Izin Karyawan',
        period: `Periode: ${period.label}`,
        generatedBy: manager.name,
        summary,
        headers: ['No', 'Nomor', 'Karyawan', 'Departemen', 'Jenis', 'Periode', 'Durasi', 'Status'],
        rows: rows.map((row) => [String(row.number), row.requestNumber, row.name, row.department, row.type, `${row.startDate} - ${row.endDate}`, row.duration, row.status]),
        widths: [28, 54, 132, 108, 88, 152, 80, 92],
        logoSvg: lakaryaLogoSvg,
      }),
      `laporan-cuti-izin-${period.slug}.pdf`,
      'application/pdf',
    );
  }

  async exportComplaints(userId: number, query: ReportQuery) {
    const manager = await this.ensureManager(userId, 'Human Resources');
    const period = this.parsePeriod(query);
    const complaints = await this.prisma.complaint.findMany({
      where: { createdAt: { gte: period.start, lt: period.end } },
      include: {
        reporter: { include: { department: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const rows = complaints.map((complaint, index) => ({
      number: index + 1,
      complaintNumber: `KLH-${complaint.id}`,
      reporter: complaint.reporter.name,
      employeeNumber: complaint.reporter.employeeNumber,
      department: complaint.reporter.department.name,
      category: this.complaintCategoryLabel(complaint.category),
      subject: complaint.subject,
      status: this.complaintStatusLabel(complaint.status),
      createdAt: this.formatDate(complaint.createdAt),
      latestNote: complaint.activities[0]?.note ?? 'Belum ada catatan penanganan',
    }));
    const statusCounts = this.countValues(complaints.map((item) => item.status));
    const summary = [
      `${complaints.length} keluhan tercatat pada periode ini.`,
      `${statusCounts.TERBUKA ?? 0} terbuka, ${statusCounts.DIPROSES ?? 0} diproses, ${statusCounts.SELESAI ?? 0} selesai, dan ${statusCounts.DITUTUP ?? 0} ditutup.`,
    ];

    if (period.format === 'csv') {
      return this.file(
        createCsv(
          ['No', 'Nomor Keluhan', 'Nama Pelapor', 'No. Pegawai', 'Departemen', 'Kategori', 'Subjek', 'Status', 'Tanggal Disampaikan', 'Catatan Penanganan Terakhir'],
          rows.map((row) => Object.values(row)),
        ),
        `laporan-keluhan-${period.slug}.csv`,
        'text/csv; charset=utf-8',
      );
    }

    return this.file(
      createTablePdf({
        title: 'Laporan Keluhan Karyawan',
        period: `Periode: ${period.label}`,
        generatedBy: manager.name,
        summary,
        headers: ['No', 'Nomor', 'Pelapor', 'Departemen', 'Kategori', 'Subjek', 'Status', 'Tanggal'],
        rows: rows.map((row) => [String(row.number), row.complaintNumber, row.reporter, row.department, row.category, row.subject, row.status, row.createdAt]),
        widths: [28, 52, 124, 100, 82, 190, 84, 72],
        logoSvg: lakaryaLogoSvg,
      }),
      `laporan-keluhan-${period.slug}.pdf`,
      'application/pdf',
    );
  }

  async exportReimbursements(userId: number, query: ReportQuery) {
    const manager = await this.ensureManager(userId, 'Finance');
    const period = this.parsePeriod(query);
    const requests = await this.prisma.request.findMany({
      where: {
        type: RequestType.PENGGANTIAN_BIAYA,
        status: { in: [RequestStatus.DISETUJUI, RequestStatus.DITOLAK] },
        reimbursementRequest: { expenseDate: { gte: period.start, lt: period.end } },
      },
      include: {
        requester: { include: { department: true } },
        reimbursementRequest: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const rows = requests.map((request, index) => ({
      number: index + 1,
      requestNumber: `REQ-${request.id}`,
      name: request.requester.name,
      employeeNumber: request.requester.employeeNumber,
      department: request.requester.department.name,
      expenseType: this.expenseTypeLabel(request.reimbursementRequest!.expenseType),
      expenseDate: this.formatDate(request.reimbursementRequest!.expenseDate),
      amount: Number(request.reimbursementRequest!.expenseAmount),
      status: this.requestStatusLabel(request.status),
      description: request.reimbursementRequest!.description,
      submittedAt: this.formatDate(request.createdAt),
    }));
    const approvedAmount = requests
      .filter((request) => request.status === RequestStatus.DISETUJUI)
      .reduce((total, request) => total + Number(request.reimbursementRequest!.expenseAmount), 0);
    const summary = [
      `${rows.length} reimbursement telah selesai diproses.`,
      this.statusSummary(requests.map((request) => request.status)),
      `Realisasi yang disetujui sebesar ${this.formatCurrency(approvedAmount)}.`,
    ];

    if (period.format === 'csv') {
      return this.file(
        createCsv(
          ['No', 'Nomor Pengajuan', 'Nama Karyawan', 'No. Pegawai', 'Departemen', 'Tipe Biaya', 'Tanggal Pengeluaran', 'Nominal (IDR)', 'Status', 'Deskripsi', 'Tanggal Diajukan'],
          rows.map((row) => Object.values(row)),
        ),
        `laporan-reimbursement-${period.slug}.csv`,
        'text/csv; charset=utf-8',
      );
    }

    return this.file(
      createTablePdf({
        title: 'Laporan Pengeluaran Reimbursement',
        period: `Periode: ${period.label}`,
        generatedBy: manager.name,
        summary,
        headers: ['No', 'Nomor', 'Karyawan', 'Departemen', 'Tipe', 'Tanggal', 'Nominal', 'Status'],
        rows: rows.map((row) => [String(row.number), row.requestNumber, row.name, row.department, row.expenseType, row.expenseDate, this.formatCurrency(row.amount), row.status]),
        widths: [28, 54, 130, 105, 88, 78, 112, 87],
        logoSvg: lakaryaLogoSvg,
      }),
      `laporan-reimbursement-${period.slug}.pdf`,
      'application/pdf',
    );
  }

  private parsePeriod(query: ReportQuery): ReportPeriod {
    const month = Number(query.month);
    const year = Number(query.year);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Bulan laporan harus berada di antara 1 dan 12.');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Tahun laporan harus berada di antara 2000 dan 2100.');
    }
    if (query.format !== 'csv' && query.format !== 'pdf') {
      throw new BadRequestException('Format laporan harus CSV atau PDF.');
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
    return { month, year, start, end, format: query.format, label, slug: `${year}-${String(month).padStart(2, '0')}` };
  }

  private async ensureManager(userId: number, department: ReportDepartment) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true, department: true } });
    if (user?.role.name !== RoleName.MANAJER || user.department.name !== department) {
      throw new ForbiddenException(`Hanya Manager ${department === 'Finance' ? 'Finance' : 'HR'} yang dapat mengekspor laporan ini.`);
    }
    return user;
  }

  private file(buffer: Buffer, filename: string, mimeType: string): ReportFile {
    return { buffer, filename, mimeType };
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(value);
  }

  private formatTime(value: Date | null) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(value);
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }

  private dayDifference(start: Date, end: Date) {
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  private countValues<T extends string>(values: T[]) {
    return values.reduce<Partial<Record<T, number>>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
  }

  private statusSummary(statuses: RequestStatus[]) {
    const count = this.countValues(statuses);
    return `${count.DISETUJUI ?? 0} disetujui dan ${count.DITOLAK ?? 0} ditolak.`;
  }

  private requestStatusLabel(value: RequestStatus) {
    return { MENUNGGU: 'Menunggu', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', DIBATALKAN: 'Dibatalkan' }[value];
  }

  private leaveTypeLabel(value: LeaveType) {
    return value === LeaveType.TAHUNAN ? 'Cuti Tahunan' : 'Cuti Khusus';
  }

  private permissionTypeLabel(value: PermissionType) {
    return value === PermissionType.HARIAN ? 'Izin Harian' : 'Izin Per Jam';
  }

  private complaintCategoryLabel(value: ComplaintCategory) {
    return { PERORANGAN: 'Perorangan', FASILITAS: 'Fasilitas', LAINNYA: 'Lainnya' }[value];
  }

  private complaintStatusLabel(value: ComplaintStatus) {
    return { TERBUKA: 'Terbuka', DIPROSES: 'Diproses', SELESAI: 'Selesai', DITUTUP: 'Ditutup' }[value];
  }

  private expenseTypeLabel(value: ExpenseType) {
    return { TRANSPORTASI: 'Transportasi', KONSUMSI: 'Konsumsi', OPERASIONAL: 'Operasional', LAINNYA: 'Lainnya' }[value];
  }
}
