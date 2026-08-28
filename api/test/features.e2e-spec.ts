import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { addDays as addDaysStr } from './../src/common/date.util';

/**
 * ตรวจ flow เงินจริงของฟีเจอร์ใหม่บน SQLite ในหน่วยความจำ:
 *  - ข้อ 1: ยอดเปิดใหม่รายวัน งวดแรกเก็บวันปล่อยเลย
 *  - ข้อ 2: ชำระดอกล่วงหน้าหลายรอบ
 *  - ข้อ 3: ชำระเฉพาะยอดค้าง
 *  - ข้อ 5: รียอด — เงินสดในมือหักแค่ส่วนที่ปล่อยจริง
 */
jest.setTimeout(30_000);

describe('ฟีเจอร์ใหม่ (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.SQLITE_PATH = ':memory:';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const res = await http()
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin1234' });
    token = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function newDebtor(name: string): Promise<string> {
    const res = await http().post('/debtors').set(auth()).send({ name });
    return (res.body as { id: string }).id;
  }

  it('ข้อ 1: ยอดรายวันเปิดใหม่ — งวดแรกครบกำหนดวันปล่อยกู้ (เก็บวันนี้เลย)', async () => {
    const debtorId = await newDebtor('เอ');
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 10_000,
        interestRatePercent: 1, // 1%/วัน = 100/วัน
        cycle: 'DAILY',
      })
      .expect(201);
    const body = loan.body as { firstDueDate: string; startDate: string };
    expect(body.startDate).toBe(today);
    expect(body.firstDueDate).toBe(today); // วันปล่อยกู้ = วันที่ 1

    const dash = await http().get('/dashboard/today').set(auth()).expect(200);
    const data = dash.body as {
      debtors: { debtorId: string; dueInterest: number }[];
    };
    const g = data.debtors.find((d) => d.debtorId === debtorId);
    expect(g?.dueInterest).toBe(100); // ดอกวันปล่อยถึงกำหนดแล้ว
  });

  it('ยอดรายสัปดาห์เปิดใหม่ — วันเปิด = วันที่ 1 แต่ดอกแรกครบเมื่อครบรอบ (วันที่ 7)', async () => {
    const debtorId = await newDebtor('รายสัปดาห์');
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 1_000,
        interestRatePercent: 20, // 20%/สัปดาห์ = 200
        cycle: 'WEEKLY',
      })
      .expect(201);
    const body = loan.body as { firstDueDate: string; startDate: string };
    expect(body.startDate).toBe(today);
    // วันเปิด = วันที่ 1 → รายสัปดาห์ครบกำหนดวันที่ 7 = วันเปิด + 6 วัน
    expect(body.firstDueDate).toBe(addDaysStr(today, 6));

    // วันเปิดยอดยังไม่ถึงกำหนดเก็บดอกรอบแรก
    const dash = await http().get('/dashboard/today').set(auth()).expect(200);
    const data = dash.body as {
      debtors: { debtorId: string; dueInterest: number }[];
    };
    const g = data.debtors.find((d) => d.debtorId === debtorId);
    expect(g?.dueInterest ?? 0).toBe(0);
  });

  it('จบต้นดอก (ผ่อนงวด) เปิดใหม่ — งวดแรกครบกำหนดวันปล่อย (วันรับเงิน = วันที่ 1)', async () => {
    const debtorId = await newDebtor('จบต้นดอก');
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        type: 'INSTALLMENT',
        principalOriginal: 1_000,
        installmentCount: 13,
        installmentTotal: 1_300, // ส่ง 100/13 วัน
        cycle: 'DAILY',
        // ไม่ส่ง firstDueDate = ให้ระบบนับวันรับเงินเป็นวันที่ 1
      })
      .expect(201);
    const body = loan.body as { firstDueDate: string; startDate: string };
    expect(body.startDate).toBe(today);
    expect(body.firstDueDate).toBe(today); // งวดแรกวันปล่อยเลย ไม่ใช่พรุ่งนี้

    const sched = await http()
      .get(`/loans/${(loan.body as { id: string }).id}/schedule`)
      .set(auth())
      .expect(200);
    const s = sched.body as { rows: { dueDate: string; status: string }[] };
    expect(s.rows[0].dueDate).toBe(today);
    expect(s.rows[0].status).toBe('DUE'); // งวดแรกถึงกำหนดวันนี้แล้ว
  });

  it('รียอดจบต้นดอก → จบต้นดอก — เหลือ 400 รับจริง 600 ปิดเก่าเปิดใหม่', async () => {
    const debtorId = await newDebtor('รียอดผ่อน');
    // จบต้นดอก: ต้น 1,000 ผ่อนรวม 1,300 (100/13 วัน)
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        type: 'INSTALLMENT',
        principalOriginal: 1_000,
        installmentCount: 13,
        installmentTotal: 1_300,
        cycle: 'DAILY',
      })
      .expect(201);
    const oldId = (loan.body as { id: string }).id;

    // ผ่อนมาแล้ว 9 งวด = 900 → เหลือ 400
    await http()
      .post('/payments')
      .set(auth())
      .send({ loanId: oldId, amount: 900, paymentType: 'PRINCIPAL' })
      .expect(201);

    const quote = await http()
      .get(`/loans/${oldId}/refinance-quote?newPrincipal=1000`)
      .set(auth())
      .expect(200);
    const q = quote.body as { remaining: number; netCash: number };
    expect(q.remaining).toBe(400); // ยอดผ่อนคงเหลือ
    expect(q.netCash).toBe(600); // รับจริง = ต้นใหม่ 1000 − เหลือ 400

    // รียอดเป็นจบต้นดอกใบใหม่ (ต้น 1,000 ผ่อน 1,300)
    const refi = await http()
      .post(`/loans/${oldId}/refinance`)
      .set(auth())
      .send({
        debtorId,
        type: 'INSTALLMENT',
        principalOriginal: 1_000,
        installmentCount: 13,
        installmentTotal: 1_300,
        cycle: 'DAILY',
      })
      .expect(201);
    const newLoan = refi.body as {
      id: string;
      status: string;
      capitalDisbursed: number;
      installmentCount: number;
    };
    expect(newLoan.status).toBe('INSTALLMENT');
    expect(newLoan.installmentCount).toBe(13);
    expect(newLoan.capitalDisbursed).toBe(600); // ปล่อยเงินสดจริงแค่ 600

    // รียอด: งวดแรกเก็บ "พรุ่งนี้" ไม่ใช่วันรียอด (ของวันนี้ส่งไปกับสัญญาเก่าแล้ว)
    const newSched = await http()
      .get(`/loans/${newLoan.id}/schedule`)
      .set(auth())
      .expect(200);
    const ns = newSched.body as {
      rows: { dueDate: string }[];
      dueNow: number;
    };
    expect(ns.rows[0].dueDate).toBe(addDaysStr(today, 1));
    expect(ns.dueNow).toBe(0); // วันรียอดไม่มียอดต้องเก็บซ้ำ

    const oldAfter = await http().get(`/loans/${oldId}`).set(auth());
    expect((oldAfter.body as { status: string }).status).toBe('CLOSED');
  });

  it('ข้อ 3: ชำระเฉพาะยอดค้าง — ไม่แตะดอก/เงินต้น', async () => {
    const debtorId = await newDebtor('บี');
    // ยอดเก่ามีค้างสะสม 500 (ส่ง outstandingPrincipal/arrears = legacy)
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 5_000,
        outstandingPrincipal: 5_000,
        arrears: 500,
        interestRatePercent: 1,
        cycle: 'DAILY',
      })
      .expect(201);
    const loanId = (loan.body as { id: string }).id;
    await http()
      .post('/payments')
      .set(auth())
      .send({ loanId, amount: 500, paymentType: 'ARREARS' })
      .expect(201);
    const after = await http().get(`/loans/${loanId}`).set(auth()).expect(200);
    const b = after.body as { arrears: number; outstandingPrincipal: number };
    expect(b.arrears).toBe(0);
    expect(b.outstandingPrincipal).toBe(5_000); // ต้นไม่ลด
  });

  it('ข้อ 2: ชำระดอกล่วงหน้า 3 รอบ — วันถัดๆ ไปขึ้นเก็บครบ', async () => {
    const debtorId = await newDebtor('ซี');
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 10_000,
        interestRatePercent: 1, // 100/วัน
        cycle: 'DAILY',
      })
      .expect(201);
    const loanId = (loan.body as { id: string }).id;
    const quote = await http()
      .get(`/payments/prepay-quote?loanId=${loanId}&count=3`)
      .set(auth())
      .expect(200);
    expect((quote.body as { total: number }).total).toBe(300);
    const paid = await http()
      .post('/payments/prepay')
      .set(auth())
      .send({ loanId, count: 3 })
      .expect(201);
    expect((paid.body as unknown[]).length).toBe(3);
    // วันถัดไปต้องเห็นว่าดอกเก็บครบแล้ว (remainingToday = 0)
    const tomorrow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
    }).format(new Date(Date.now() + 86_400_000));
    const dash = await http()
      .get(`/dashboard/today?date=${tomorrow}`)
      .set(auth())
      .expect(200);
    const g = (
      dash.body as { debtors: { debtorId: string; remainingToday: number }[] }
    ).debtors.find((d) => d.debtorId === debtorId);
    expect(g?.remainingToday ?? 0).toBe(0);
  });

  it('ข้อ 5: รียอด — เงินสดในมือหักแค่ส่วนที่ปล่อยจริง (600 ไม่ใช่ 1000)', async () => {
    const before = await http().get('/finance/cash').set(auth()).expect(200);
    const cashBefore = (before.body as { cashInHand: number }).cashInHand;

    const debtorId = await newDebtor('ดี');
    // ยอดเดิม: ต้น 1,000 (ปล่อยจากทุน) เหลือ 400 หลังลดต้น 600
    const loan = await http()
      .post('/loans')
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 1_000,
        interestRatePercent: 1,
        cycle: 'DAILY',
      })
      .expect(201);
    const oldId = (loan.body as { id: string }).id;
    await http()
      .post('/payments')
      .set(auth())
      .send({ loanId: oldId, amount: 600, paymentType: 'PRINCIPAL' })
      .expect(201);

    const afterOld = await http().get('/finance/cash').set(auth());
    const cashAfterOld = (afterOld.body as { cashInHand: number }).cashInHand;
    // ปล่อย 1000 แล้วเก็บคืนต้น 600 → เงินสดลดสุทธิ 400
    expect(cashAfterOld).toBe(cashBefore - 400);

    const quote = await http()
      .get(`/loans/${oldId}/refinance-quote?newPrincipal=1000`)
      .set(auth())
      .expect(200);
    const q = quote.body as { remaining: number; netCash: number };
    expect(q.remaining).toBe(400);
    expect(q.netCash).toBe(600);

    const refi = await http()
      .post(`/loans/${oldId}/refinance`)
      .set(auth())
      .send({
        debtorId,
        principalOriginal: 1_000,
        interestRatePercent: 1,
        cycle: 'DAILY',
      })
      .expect(201);
    const newLoan = refi.body as {
      id: string;
      principalOriginal: number;
      capitalDisbursed: number;
      status: string;
      firstDueDate: string;
    };
    expect(newLoan.principalOriginal).toBe(1_000);
    expect(newLoan.capitalDisbursed).toBe(600);
    // รียอด: ดอกรอบแรกเก็บพรุ่งนี้ ไม่ใช่วันรียอด (ดอกของวันนี้เก็บไปกับสัญญาเก่าแล้ว)
    expect(newLoan.firstDueDate).toBe(addDaysStr(today, 1));

    // สัญญาเดิมต้องปิด
    const oldAfter = await http().get(`/loans/${oldId}`).set(auth());
    expect((oldAfter.body as { status: string }).status).toBe('CLOSED');

    // เงินสด: จ่ายเพิ่มจริง 600 → ลดจาก cashAfterOld อีก 600
    const afterRefi = await http().get('/finance/cash').set(auth());
    const cashAfterRefi = (afterRefi.body as { cashInHand: number }).cashInHand;
    expect(cashAfterRefi).toBe(cashAfterOld - 600);
  });
});
