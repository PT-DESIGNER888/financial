import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Debtor } from '../entities/debtor.entity';
import { CashTx } from '../entities/cash-tx.entity';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { Setting } from '../entities/setting.entity';
import { LoansModule } from '../loans/loans.module';
import { ExcelReportService } from './excel-report.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashTx, Setting, Loan, Payment, Debtor]),
    LoansModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, ExcelReportService],
  exports: [FinanceService],
})
export class FinanceModule {}
