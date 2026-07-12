import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity, ActivityType } from '../entities/activity.entity';

export interface LogInput {
  type: ActivityType;
  message: string;
  debtorId?: string | null;
  loanId?: string | null;
  debtorName?: string | null;
  reason?: string | null;
  amount?: number | null;
  meta?: Record<string, unknown> | null;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity) private activities: Repository<Activity>,
  ) {}

  log(input: LogInput): Promise<Activity> {
    return this.activities.save(
      this.activities.create({
        type: input.type,
        message: input.message,
        debtorId: input.debtorId ?? null,
        loanId: input.loanId ?? null,
        debtorName: input.debtorName ?? null,
        reason: input.reason ?? null,
        amount: input.amount ?? null,
        meta: input.meta ?? null,
      }),
    );
  }

  /** รายการล่าสุด (ใช้ทำสมุดธุรกรรมในเฟสรายงาน) */
  list(opts: { debtorId?: string; loanId?: string; limit?: number } = {}) {
    const qb = this.activities
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .limit(opts.limit ?? 100);
    if (opts.debtorId) qb.andWhere('a.debtorId = :d', { d: opts.debtorId });
    if (opts.loanId) qb.andWhere('a.loanId = :l', { l: opts.loanId });
    return qb.getMany();
  }
}
