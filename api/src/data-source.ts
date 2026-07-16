import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { Attachment } from './entities/attachment.entity';
import { CashTx } from './entities/cash-tx.entity';
import { Debtor } from './entities/debtor.entity';
import { Loan } from './entities/loan.entity';
import { LoanCycle } from './entities/loan-cycle.entity';
import { Payment } from './entities/payment.entity';
import { Setting } from './entities/setting.entity';
import { User } from './entities/user.entity';

/**
 * DataSource สำหรับ TypeORM CLI (migration:generate / run / revert) — ชี้ Postgres เท่านั้น
 * ใช้: npm run typeorm -- migration:generate src/migrations/ชื่อการแก้ไข
 * (ต้องมี DATABASE_URL จริงใน api/.env ก่อน)
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Debtor,
    Loan,
    LoanCycle,
    Payment,
    Activity,
    CashTx,
    Setting,
    Attachment,
  ],
  migrations: ['src/migrations/*.ts'],
  ssl: { rejectUnauthorized: false },
});
