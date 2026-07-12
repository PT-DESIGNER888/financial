import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ActivityModule } from './activity/activity.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DebtorsModule } from './debtors/debtors.module';
import { Activity } from './entities/activity.entity';
import { Attachment } from './entities/attachment.entity';
import { CashTx } from './entities/cash-tx.entity';
import { Debtor } from './entities/debtor.entity';
import { Loan } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
import { Setting } from './entities/setting.entity';
import { User } from './entities/user.entity';
import { FinanceModule } from './finance/finance.module';
import { LoansModule } from './loans/loans.module';
import { NotifyModule } from './notify/notify.module';
import { PaymentsModule } from './payments/payments.module';

const entities = [
  User,
  Debtor,
  Loan,
  Payment,
  Activity,
  CashTx,
  Setting,
  Attachment,
];

/**
 * production: DATABASE_URL เป็น postgres (Supabase)
 * dev บนเครื่อง: ไม่ตั้ง DATABASE_URL → ใช้ไฟล์ SQLite (api/data/dev.sqlite)
 */
function buildDbOptions(config: ConfigService): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL');
  if (url && url.startsWith('postgres')) {
    return {
      type: 'postgres',
      url,
      entities,
      synchronize: true, // v1: ให้ TypeORM สร้างตารางเอง
      ssl: { rejectUnauthorized: false }, // Supabase ต้องใช้ SSL
    };
  }
  return {
    type: 'better-sqlite3',
    database: 'data/dev.sqlite',
    entities,
    synchronize: true,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildDbOptions,
    }),
    AuthModule,
    DebtorsModule,
    LoansModule,
    PaymentsModule,
    DashboardModule,
    ActivityModule,
    FinanceModule,
    NotifyModule,
    AttachmentsModule,
    BackupModule,
  ],
})
export class AppModule {}
