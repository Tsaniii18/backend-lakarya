import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AttachmentService,
  RequestAttachmentFile,
} from './attachment.service';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post(':requestId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadRequestAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', ParseIntPipe) requestId: number,
    @UploadedFile() file?: RequestAttachmentFile,
  ) {
    return this.attachmentService.uploadRequestAttachment(
      request.user.id,
      requestId,
      file,
    );
  }

  @Get(':requestId/attachments/:attachmentId')
  async getRequestAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', ParseIntPipe) requestId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ) {
    const attachment = await this.attachmentService.getRequestAttachment(
      request.user.id,
      requestId,
      attachmentId,
    );
    const safeFileName = attachment.fileName.replace(/["\r\n]/g, '-');

    return new StreamableFile(attachment.body, {
      type: attachment.contentType,
      disposition: `inline; filename="${safeFileName}"`,
    });
  }
}
