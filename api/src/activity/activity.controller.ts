import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activities')
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get()
  list(
    @Query('debtorId') debtorId?: string,
    @Query('loanId') loanId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activity.list({
      debtorId,
      loanId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
