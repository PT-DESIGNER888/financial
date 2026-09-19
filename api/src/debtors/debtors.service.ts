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
      relationLoadStrategy: 'query',
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    // ไม่ใส่ order ซ้อน relation กับ relationLoadStrategy:'query' (กัน distinctAlias error)
    const debtor = await this.debtors.findOne({
      where: { id },
      // โหลด cycles ด้วย — กัน accrue → ensureCycles ยิง N+1 ต่อสัญญา
      relations: { loans: { payments: true, cycles: true } },
      relationLoadStrategy: 'query',
    });
    if (!debtor) throw new NotFoundException('ไม่พบลูกหนี้');
    debtor.loans = [...(debtor.loans ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    debtor.loans = await Promise.all(
      debtor.loans.map((l) => this.loansService.accrue(l)),
    );
    return Object.assign(debtor, {
      financialSummary: this.loansService.debtorFinancialSummary(debtor.loans),
    });
  }

  create(input: {
    name: string;
    phone?: string;
    facebookUrl?: string;
    lineId?: string;
    note?: string;
    emergencyContacts?: Array<{
      name: string;
      phone?: string;
      line?: string;
      note?: string;
    }>;
  }) {
    const contacts = sanitizeContacts(input.emergencyContacts);
    const legacy = syncLegacyContacts(contacts);
    return this.debtors.save(
      this.debtors.create({
        name: input.name,
        phone: input.phone ?? null,
        facebookUrl: input.facebookUrl ?? null,
        lineId: input.lineId ?? null,
        note: input.note ?? null,
        emergencyContacts: contacts,
        ...legacy,
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
      emergencyContacts?: Array<{
        name: string;
        phone?: string;
        line?: string;
        note?: string;
      }>;
    },
  ) {
    const before = await this.findOne(id);
    const patch: Record<string, unknown> = { ...input };
    if (input.emergencyContacts !== undefined) {
      const contacts = sanitizeContacts(input.emergencyContacts);
      patch.emergencyContacts = contacts;
      Object.assign(patch, syncLegacyContacts(contacts));
    }
    await this.debtors.update(id, patch);
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

type Contact = {
  name: string;
  phone?: string;
  line?: string;
  note?: string;
};

function sanitizeContacts(list?: Contact[]): Contact[] | null {
  if (!list?.length) return null;
  const cleaned = list
    .map((c) => ({
      name: (c.name ?? '').trim(),
      phone: (c.phone ?? '').trim() || undefined,
      line: (c.line ?? '').trim() || undefined,
      note: (c.note ?? '').trim() || undefined,
    }))
    .filter((c) => c.name || c.phone || c.line || c.note);
  return cleaned.length ? cleaned : null;
}

/** คง relative/guarantor ให้ระบบเก่าที่อ่านคอลัมน์เดิมยังใช้ได้ */
function syncLegacyContacts(contacts: Contact[] | null) {
  const a = contacts?.[0];
  const b = contacts?.[1];
  return {
    relativeName: a?.name || null,
    relativePhone: a?.phone || null,
    guarantorName: b?.name || null,
    guarantorPhone: b?.phone || null,
  };
}
