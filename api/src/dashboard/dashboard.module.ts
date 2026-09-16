import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Debtor } from '../entities/debtor.entity';
import { Loan } from '../entities/loan.entity';
import { LoanCycle } from '../entities/loan-cycle.entity';
import { Payment } from '../entities/payment.entity';
import { LoansModule } from '../loans/loans.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debtor, Loan, LoanCycle, Payment]),
    LoansModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
