import { Controller, Get, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';

class ExportReportQueryDto {
  month?: string;
  year?: string;
  format?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('hr/leave-permission')
  async exportLeavePermission(@Req() request: AuthenticatedRequest, @Query() query: ExportReportQueryDto) {
    return this.toDownload(await this.reportService.exportLeavePermission(request.user.id, query));
  }

  @Get('hr/complaints')
  async exportComplaints(@Req() request: AuthenticatedRequest, @Query() query: ExportReportQueryDto) {
    return this.toDownload(await this.reportService.exportComplaints(request.user.id, query));
  }

  @Get('finance/reimbursements')
  async exportReimbursements(@Req() request: AuthenticatedRequest, @Query() query: ExportReportQueryDto) {
    return this.toDownload(await this.reportService.exportReimbursements(request.user.id, query));
  }

  private toDownload(file: { buffer: Buffer; filename: string; mimeType: string }) {
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${file.filename}"`,
      length: file.buffer.length,
    });
  }
}
