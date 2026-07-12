import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('today')
  today() {
    return this.dashboard.today();
  }

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }
}
