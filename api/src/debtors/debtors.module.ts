import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityModule } from '../activity/activity.module';
import { Debtor } from '../entities/debtor.entity';
import { LoansModule } from '../loans/loans.module';
import { DebtorsController } from './debtors.controller';
import { DebtorsService } from './debtors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Debtor]), LoansModule, ActivityModule],
  controllers: [DebtorsController],
  providers: [DebtorsService],
})
export class DebtorsModule {}
