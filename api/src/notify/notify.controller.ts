import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { NotifyService } from './notify.service';

class LineConfigDto {
  @IsString() @IsNotEmpty() token: string;
  @IsString() @IsNotEmpty() targetId: string;
}

@Controller('notify')
export class NotifyController {
  constructor(private notify: NotifyService) {}

  @Get('config')
  getConfig() {
    return this.notify.getConfig();
  }

  @Post('config')
  setConfig(@Body() dto: LineConfigDto) {
    return this.notify.setConfig(dto.token, dto.targetId);
  }

  @Get('overdue')
  overdue() {
    return this.notify.overdue();
  }

  @Get('daily-summary/preview')
  async preview() {
    return { message: await this.notify.composeDailySummary() };
  }

  @Post('daily-summary/send')
  send() {
    return this.notify.sendDailySummary();
  }
}
