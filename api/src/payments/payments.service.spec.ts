import { PaymentType } from '../common/enums';
import { allocatePayment } from './payments.service';

const alloc = (
  amount: number,
  over: Partial<Parameters<typeof allocatePayment>[0]> = {},
) =>
  allocatePayment({
    amount,
    paymentType: PaymentType.INTEREST,
    interestRemaining: 100,
    arrearsDue: 500,
    principalBalance: 5_000,
    ...over,
  });

describe('allocatePayment — ดอกรอบนี้ก่อน แล้วค่อยค้างเก่า', () => {
  it('เก็บดอกวันนี้พอดี → ตัดดอกรอบนี้ครบ ไม่ไปโดนค้างเก่า', () => {
    const r = alloc(100);
    expect(r.interestPaid).toBe(100);
    expect(r.arrearsPaid).toBe(0);
  });

  it('ส่งมาเกินดอกวันนี้ → ส่วนเกินไปหักค้างเก่า', () => {
    const r = alloc(300);
    expect(r.interestPaid).toBe(100);
    expect(r.arrearsPaid).toBe(200);
  });

  it('แบ่งส่งเช้าครึ่ง — ครึ่งแรกยังเข้าดอกวันนี้ก่อน', () => {
    const r = alloc(50);
    expect(r.interestPaid).toBe(50);
    expect(r.arrearsPaid).toBe(0);
  });

  it('จ่ายคืนทั้งหมด → ครบทั้งดอก ค้างเก่า และตัดต้น', () => {
    const r = alloc(5_600, { paymentType: PaymentType.BOTH });
    expect(r).toMatchObject({
      interestPaid: 100,
      arrearsPaid: 500,
      principalPaid: 5_000,
    });
  });

  it('ชำระดอก: เงินไม่ไหลไปตัดต้นแม้จ่ายเกิน', () => {
    const r = alloc(9_999, { paymentType: PaymentType.INTEREST });
    expect(r.principalPaid).toBe(0);
    expect(r.maxReceivable).toBe(600); // ดอก 100 + ค้าง 500
  });

  it('ลดเงินต้น: ไม่แตะดอกและค้างเก่า', () => {
    const r = alloc(1_000, { paymentType: PaymentType.PRINCIPAL });
    expect(r).toMatchObject({
      interestPaid: 0,
      arrearsPaid: 0,
      principalPaid: 1_000,
    });
  });

  it('ชำระเฉพาะค้าง: เข้าค้างเก่าอย่างเดียว ไม่แตะดอกรอบนี้/เงินต้น', () => {
    const r = alloc(500, { paymentType: PaymentType.ARREARS });
    expect(r).toMatchObject({
      interestPaid: 0,
      arrearsPaid: 500,
      principalPaid: 0,
    });
    expect(r.maxReceivable).toBe(500); // เก็บได้สูงสุด = ยอดค้างเก่าเท่านั้น
  });

  it('ชำระเฉพาะค้าง: จ่ายเกินค้าง ส่วนเกินไม่ไหลไปดอก/ต้น', () => {
    const r = alloc(9_999, { paymentType: PaymentType.ARREARS });
    expect(r.arrearsPaid).toBe(500);
    expect(r.interestPaid).toBe(0);
    expect(r.principalPaid).toBe(0);
  });

  it('ไม่มีค้างเก่า → เหมือนเดิมทุกอย่าง', () => {
    const r = alloc(100, { arrearsDue: 0 });
    expect(r.interestPaid).toBe(100);
    expect(r.arrearsPaid).toBe(0);
  });

  it('วันที่ไม่มีรอบครบกำหนด แต่มีค้างเก่า → เงินเข้าค้างเก่าตามเดิม', () => {
    const r = alloc(300, { interestRemaining: 0 });
    expect(r.interestPaid).toBe(0);
    expect(r.arrearsPaid).toBe(300);
  });

  it('เก็บดอกครบทุกวัน ยอดค้างเก่าต้องไม่โตขึ้น', () => {
    // จำลอง 5 รอบ: เก็บดอกรอบละ 100 พอดีทุกครั้ง ค้างเก่าเดิม 500 ต้องนิ่ง
    let arrears = 500;
    for (let i = 0; i < 5; i++) {
      const r = alloc(100, { arrearsDue: arrears });
      arrears = arrears - r.arrearsPaid;
      // ดอกรอบนี้จ่ายครบ = ตอนจบรอบไม่มีอะไรตกไปเป็นยอดค้างเพิ่ม
      const unpaidThisCycle = 100 - r.interestPaid;
      arrears += unpaidThisCycle;
    }
    expect(arrears).toBe(500);
  });
});
