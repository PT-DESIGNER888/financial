import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { Debtor } from '../entities/debtor.entity';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class DebtorsService {
  constructor(
    @InjectRepository(Debtor) private debtors: Repository<Debtor>,
    private loansService: LoansService,
    private activity: ActivityService,
  ) {}

  findAll() {
    return this.debtors.find({
      relations: { loans: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const debtor = await this.debtors.findOne({
      where: { id },
      relations: { loans: { payments: true } },
      order: { loans: { createdAt: 'DESC' } },
    });
    if (!debtor) throw new NotFoundException('ไม่พบลูกหนี้');
    debtor.loans = await Promise.all(
      debtor.loans.map((l) => this.loansService.accrue(l)),
    );
    return debtor;
  }

  create(input: {
    name: string;
    phone?: string;
    facebookUrl?: string;
    lineId?: string;
    note?: string;
  }) {
    return this.debtors.save(
      this.debtors.create({
        name: input.name,
        phone: input.phone ?? null,
        facebookUrl: input.facebookUrl ?? null,
        lineId: input.lineId ?? null,
        note: input.note ?? null,
      }),
    );
  }

  async update(
    id: string,
    input: {
      name?: string;
      phone?: string;
      facebookUrl?: string;
      lineId?: string;
      relativeName?: string;
      relativePhone?: string;
      note?: string;
      blacklisted?: boolean;
      creditNote?: string;
      guarantorName?: string;
      guarantorPhone?: string;
    },
  ) {
    const before = await this.findOne(id);
    await this.debtors.update(id, input);
    await this.activity.log({
      type: 'EDIT_DEBTOR',
      debtorId: id,
      debtorName: input.name ?? before.name,
      message: 'แก้ข้อมูลลูกหนี้',
    });
    return this.findOne(id);
  }

  /** ลบลูกหนี้ พร้อมยอดกู้และประวัติทั้งหมด (cascade) */
  async remove(id: string): Promise<void> {
    const debtor = await this.findOne(id);
    const loanCount = debtor.loans?.length ?? 0;
    await this.debtors.delete(id);
    await this.activity.log({
      type: 'DELETE_DEBTOR',
      debtorId: id,
      debtorName: debtor.name,
      message: `ลบลูกหนี้ "${debtor.name}" (${loanCount} ยอดกู้)`,
    });
  }
}
