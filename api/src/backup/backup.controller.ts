import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private backup: BackupService) {}

  @Get('export')
  async export(@Res() res: Response) {
    const data = await this.backup.export();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="money-backup-${stamp}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  @Post('import')
  import(@Body() data: Record<string, unknown[]>) {
    return this.backup.import(data);
  }
}
