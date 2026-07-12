import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from '../entities/loan.entity';
import { Setting } from '../entities/setting.entity';
import { LoansModule } from '../loans/loans.module';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Setting]), LoansModule],
  controllers: [NotifyController],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
