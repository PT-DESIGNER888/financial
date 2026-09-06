import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';
import type { AttachmentKind } from '../entities/attachment.entity';
import { StorageService } from './storage.service';

interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Controller()
export class AttachmentsController {
  constructor(
    @InjectRepository(Attachment)
    private attachments: Repository<Attachment>,
    private storage: StorageService,
  ) {}

  @Get('storage/status')
  status() {
    return { configured: this.storage.configured };
  }

  @Get('debtors/:id/attachments')
  async list(@Param('id') id: string) {
    const rows = await this.attachments.find({
      where: { debtorId: id },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      rows.map(async (a) => ({
        ...a,
        signedUrl: await this.storage.signedUrl(a.path),
      })),
    );
  }

  /** ส่งไฟล์ให้หน้าเว็บหลังล็อกอิน — ไม่พึ่งลิงก์ public ของบัคเก็ต */
  @Get('attachments/:id/file')
  async file(@Param('id') id: string) {
    const a = await this.attachments.findOneBy({ id });
    if (!a) throw new NotFoundException('ไม่พบไฟล์แนบ');
    const { buffer, contentType } = await this.storage.download(a.path, a.url);
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: 'inline',
    });
  }

  @Post('debtors/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id') debtorId: string,
    @UploadedFile() file: UploadedFileLike,
    @Body('kind') kind: AttachmentKind = 'OTHER',
    @Body('note') note?: string,
  ) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์');
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : 'bin';
    const path = `${debtorId}/${Date.now()}.${ext}`;
    const { url } = await this.storage.upload(path, file.buffer, file.mimetype);
    return this.attachments.save(
      this.attachments.create({
        debtorId,
        kind: kind ?? 'OTHER',
        filename: file.originalname,
        path,
        url,
        note: note ?? null,
      }),
    );
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const a = await this.attachments.findOneBy({ id });
    if (a) {
      await this.storage.remove(a.path);
      await this.attachments.delete(id);
    }
  }
}
