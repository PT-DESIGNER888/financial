import {
  quoteInterestAppointment,
  settleAppointmentGroup,
  collectionInterestOnDay,
  hidesWeeklyDueOn,
  isAppointmentOpen,
  projectCyclesUntil,
} from './interest-appointment';

const interest = (n: number) => ({ interest: n, remaining: n });

describe('นัดชำระดอก — คิดรายรอบ เก็บเป็นก้อน', () => {
  it('ต้น 2,000 ดอก 20% สัปดาห์ — นัด 4 อาทิตย์ รวม 1,600', () => {
    const q = quoteInterestAppointment({
      date: '2026-09-24',
      startDue: '2026-09-03',
      step: 7,
      windowStart: '2026-08-27',
      agreedAmount: null,
      payments: [],
      interestForDue: () => interest(400),
    });
    expect(q.cycles.map((c) => c.dueDate)).toEqual([
      '2026-09-03',
      '2026-09-10',
      '2026-09-17',
      '2026-09-24',
    ]);
    expect(q.computedTotal).toBe(1_600);
    expect(q.agreedAmount).toBe(1_600);
    expect(q.remaining).toBe(1_600);
  });

  it('นัด 13 ก.ย. ข้ามรอบ 10 ก.ย. — รวม 2 รอบ เสนอ 800', () => {
    const q = quoteInterestAppointment({
      date: '2026-09-13',
      startDue: '2026-09-03',
      step: 7,
      windowStart: '2026-08-27',
      agreedAmount: null,
      payments: [],
      interestForDue: () => interest(400),
    });
    expect(q.cycles.map((c) => c.dueDate)).toEqual([
      '2026-09-03',
      '2026-09-10',
    ]);
    expect(q.computedTotal).toBe(800);
  });

  it('กรอกมือ 400 ทั้งที่ระบบเสนอ 800 — remaining ตามที่ยอดตกลง', () => {
    const q = quoteInterestAppointment({
      date: '2026-09-13',
      startDue: '2026-09-03',
      step: 7,
      windowStart: '2026-08-27',
      agreedAmount: 400,
      payments: [],
      interestForDue: () => interest(400),
    });
    expect(q.computedTotal).toBe(800);
    expect(q.agreedAmount).toBe(400);
    expect(q.remaining).toBe(400);
  });

  it('จ่ายระหว่างนัดแล้วนับเข้าก้อน ไม่ผูกแค่รอบสุดท้าย', () => {
    const q = quoteInterestAppointment({
      date: '2026-09-24',
      startDue: '2026-09-03',
      step: 7,
      windowStart: '2026-08-27',
      agreedAmount: null,
      payments: [{ paidDate: '2026-09-11', interestPaid: 400 }],
      interestForDue: () => interest(400),
    });
    expect(q.paid).toBe(400);
    expect(q.remaining).toBe(1_200);
  });

  it('เลือกวันก่อนรอบปัจจุบัน — ไม่มีรอบในนัด', () => {
    expect(
      projectCyclesUntil({
        startDue: '2026-09-10',
        until: '2026-09-03',
        step: 7,
        interestForDue: () => interest(400),
      }),
    ).toEqual([]);
  });
});

describe('ซ่อนรอบกลางจากหน้าเก็บวันนี้', () => {
  it('รอบ 10 ก.ย. ถูกซ่อน ถ้านัด 13 ก.ย.', () => {
    expect(
      hidesWeeklyDueOn({
        interestDueDate: '2026-09-13',
        day: '2026-09-10',
        isCycleDue: true,
      }),
    ).toBe(true);
  });

  it('วันนัดเองไม่ซ่อน — โชว์ก้อนรวม', () => {
    expect(
      hidesWeeklyDueOn({
        interestDueDate: '2026-09-24',
        day: '2026-09-24',
        isCycleDue: true,
      }),
    ).toBe(false);
  });

  it('ไม่มีนัด — ไม่ซ่อน', () => {
    expect(
      hidesWeeklyDueOn({
        interestDueDate: null,
        day: '2026-09-10',
        isCycleDue: true,
      }),
    ).toBe(false);
  });

  it('วันนัดโชว์ยอดก้อน วันรอบกลางเป็น 0 วันไม่มีนัดใช้ดอกรอบ', () => {
    const weekly = { weeklyDue: 400, weeklyRemaining: 400, isCycleDue: true };
    expect(
      collectionInterestOnDay({
        interestDueDate: '2026-09-24',
        day: '2026-09-24',
        agreedDue: 1_600,
        agreedRemaining: 1_600,
        ...weekly,
      }),
    ).toEqual({ dueInterest: 1_600, remainingInterest: 1_600 });
    expect(
      collectionInterestOnDay({
        interestDueDate: '2026-09-24',
        day: '2026-09-10',
        agreedDue: 1_600,
        agreedRemaining: 1_600,
        ...weekly,
      }),
    ).toEqual({ dueInterest: 0, remainingInterest: 0 });
    expect(
      collectionInterestOnDay({
        interestDueDate: null,
        day: '2026-09-10',
        agreedDue: 0,
        agreedRemaining: 0,
        ...weekly,
      }),
    ).toEqual({ dueInterest: 400, remainingInterest: 400 });
  });
});

describe('นัดยังเปิดอยู่ / จบนัดแล้วเข้าค้าง', () => {
  it('ถึงวันนัดแล้วยังเปิด (ยังไม่ข้ามวัน)', () => {
    expect(isAppointmentOpen('2026-09-13', '2026-09-13')).toBe(true);
    expect(isAppointmentOpen('2026-09-13', '2026-09-12')).toBe(true);
    expect(isAppointmentOpen('2026-09-13', '2026-09-14')).toBe(false);
    expect(isAppointmentOpen(null, '2026-09-13')).toBe(false);
  });

  it('จ่ายครบก้อน — ไม่เข้าค้าง รอบในนัดปิดหมด', () => {
    const r = settleAppointmentGroup({
      covered: [
        { id: 'a', interest: 400 },
        { id: 'b', interest: 400 },
      ],
      groupDue: 800,
      groupPaid: 800,
    });
    expect(r.addedArrears).toBe(0);
    expect(r.patches.map((p) => p.accruedAmount)).toEqual([0, 0]);
  });

  it('เลยวันนัดแล้วยังไม่จ่าย — ทั้งก้อนเข้าค้างที่รอบสุดท้าย', () => {
    const r = settleAppointmentGroup({
      covered: [
        { id: 'a', interest: 400 },
        { id: 'b', interest: 400 },
      ],
      groupDue: 800,
      groupPaid: 0,
    });
    expect(r.addedArrears).toBe(800);
    expect(r.patches).toEqual([
      { id: 'a', accruedAmount: 0 },
      { id: 'b', accruedAmount: 800 },
    ]);
  });

  it('ตกลงเก็บ 400 จากที่ระบบเสนอ 800 แล้วจ่ายครบตามตกลง — ไม่ค้างส่วนต่าง', () => {
    const r = settleAppointmentGroup({
      covered: [
        { id: 'a', interest: 400 },
        { id: 'b', interest: 400 },
      ],
      groupDue: 400,
      groupPaid: 400,
    });
    expect(r.addedArrears).toBe(0);
  });
});
