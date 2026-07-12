import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashTx } from '../entities/cash-tx.entity';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { Setting } from '../entities/setting.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [TypeOrmModule.forFeature([CashTx, Setting, Loan, Payment])],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
