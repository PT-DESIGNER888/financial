/**
 * ข้อมูลตัวอย่างที่ตัวเลขสัมพันธ์กัน (คำนวณตรวจได้)
 * ให้หน้า "เก็บวันนี้" และหน้ารายละเอียดลูกหนี้ดูสมเหตุสมผล
 *
 * ใช้: node scripts/seed-demo.mjs
 * ใส่ FORCE=1 เพื่อลบ DEMO เก่าแล้วสร้างใหม่
 * ต้องรัน API ที่ localhost:3001 แล้ว
 */
const BASE = process.env.API_URL ?? 'http://localhost:3001';
const SEED_TAG = 'DEMO_SEED_v2';
const FORCE = process.env.FORCE === '1' || process.argv.includes('--force');

function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function api(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? res.statusText);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function main() {
  const today = bangkokToday();
  console.log(`API ${BASE} · วันนี้ (Bangkok) = ${today} · tag ${SEED_TAG}`);

  const login = await api(null, '/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin1234' },
  });
  const token = login.accessToken;

  const existing = await api(token, '/debtors');
  const demoDebtors = existing.filter(
    (d) =>
      typeof d.note === 'string' &&
      (d.note.startsWith('DEMO_SEED') || d.note.includes('DEMO_SEED')),
  );

  if (demoDebtors.length && !FORCE) {
    console.log(
      `มีข้อมูล DEMO อยู่แล้ว ${demoDebtors.length} คน — ข้าม (ใส่ FORCE=1 หรือ --force เพื่อสร้างใหม่)`,
    );
    const todayDash = await api(token, '/dashboard/today');
    console.log(`เก็บวันนี้: ${todayDash.items.length} รายการ`);
    return;
  }

  for (const d of demoDebtors) {
    await api(token, `/debtors/${d.id}`, { method: 'DELETE' });
    console.log(`− ลบ DEMO เก่า: ${d.name}`);
  }

  /**
   * พอร์ตตัวอย่าง (ตัวเลขตรวจคร่าวๆ ได้):
   *
   * สมชาย  ต้น 10,000 · ดอก 1%/วัน = 100 → จ่ายวันนี้ 1,100 (ดอก 100 + ตัดต้น 1,000) → ต้นเหลือ 9,000
   * มาลี   ต้น 30,000 · ดอกคงที่ 3%/10วัน = 900 · ครบรอบวันนี้
   * วิชัย  ต้นเดิม 20,000 ตัดเหลือ 18,000 · ดอกค้าง 2 วัน × 270 = 540 · วันนี้ดอกเพิ่ม 270 → รวมเก็บ 810
   * นภา    ผ่อนมือถือ ต้น 5,000 / รวม 6,000 / 6 งวด × 1,000 · เปิดมา 4 วัน · จ่ายไป 2 งวด → เหลือผ่อน 4,000 · ต้นสัดส่วน 3,333.33
   * ประยุทธ์ ต้น 50,000 · 2%/วัน = 1,000 (+ ยอด 10 วันอีกก้อนยังไม่ครบรอบ)
   */
  const people = [
    {
      name: 'สมชาย จันทร์เพ็ญ',
      phone: '081-234-5678',
      lineId: 'somchai.j',
      facebookUrl: 'https://facebook.com/somchai.jan',
      note: SEED_TAG,
      creditNote: 'จ่ายตรงค่อนข้างดี — ตัวอย่างตัดต้นทอนยอด',
      emergencyContacts: [
        {
          name: 'สมหญิง จันทร์เพ็ญ',
          phone: '081-234-5699',
          line: 'somying.j',
          note: 'ภรรยา',
        },
        {
          name: 'สมศักดิ์ จันทร์เพ็ญ',
          phone: '089-000-1122',
          line: 'somsak.j',
          note: 'พี่ชาย',
        },
      ],
      loans: [
        {
          principalOriginal: 10000,
          outstandingPrincipal: 10000,
          interestRatePercent: 1,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'กู้ 10,000 · ดอก 1%/วัน = 100',
        },
      ],
      // ดอกวันนี้ 100 + ตัดต้น 1,000 = 1,100 → ต้นเหลือ 9,000
      pays: [
        {
          index: 0,
          amount: 1100,
          arrearsPaid: 0,
          interestPaid: 100,
          principalPaid: 1000,
          note: 'ตัวอย่าง: ดอกครบ + ตัดต้น 1,000',
        },
      ],
    },
    {
      name: 'มาลี ศรีสุข',
      phone: '089-111-2233',
      facebookUrl: 'https://facebook.com/malee.srisuk',
      lineId: 'malee.ss',
      note: SEED_TAG,
      creditNote: 'ยอด 10 วัน ดอกคงที่',
      emergencyContacts: [
        {
          name: 'สมบัติ ศรีสุข',
          phone: '089-111-2244',
          line: 'sombat.ss',
          note: 'สามี',
        },
      ],
      loans: [
        {
          principalOriginal: 30000,
          outstandingPrincipal: 30000,
          interestRatePercent: 3,
          cycle: 'TEN_DAY',
          interestMode: 'FLAT',
          startDate: addDays(today, -10),
          note: 'กู้ 30,000 · ดอกคงที่ 3%/10วัน = 900 · ครบรอบวันนี้',
        },
      ],
    },
    {
      name: 'วิชัย พูนผล',
      phone: '062-555-7788',
      lineId: 'wichai.p',
      note: SEED_TAG,
      creditNote: 'เคยเลื่อนจ่าย — มีดอกค้าง 2 รอบ',
      emergencyContacts: [
        {
          name: 'วิไล พูนผล',
          phone: '062-555-7799',
          line: 'wilai.p',
          note: 'น้องสาว',
        },
      ],
      loans: [
        {
          // ต้นเดิม 20,000 ตัดไปแล้ว 2,000 → เหลือ 18,000
          // ดอก 1.5% ของ 18,000 = 270/วัน × ค้าง 2 วัน = 540
          principalOriginal: 20000,
          outstandingPrincipal: 18000,
          arrears: 540,
          interestRatePercent: 1.5,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'ต้นเหลือ 18,000 (ตัดไป 2,000) · ค้างดอก 2×270 = 540',
        },
      ],
    },
    {
      name: 'นภา อรุณรุ่ง',
      phone: '086-999-0001',
      lineId: 'napha.arun',
      facebookUrl: 'https://facebook.com/napha.arun',
      note: SEED_TAG,
      creditNote: 'ผ่อนมือถือ — จ่ายงวดแรกสองงวดแล้ว',
      emergencyContacts: [
        {
          name: 'นพดล อรุณรุ่ง',
          phone: '086-999-0002',
          line: 'nopadol.a',
          note: 'พ่อ',
        },
      ],
      loans: [
        {
          type: 'INSTALLMENT',
          principalOriginal: 5000,
          installmentTotal: 6000,
          installmentCount: 6,
          cycle: 'DAILY',
          startDate: addDays(today, -4),
          note: 'ผ่อนมือถือ · ต้น 5,000 / รวม 6,000 / 6 งวด × 1,000',
        },
      ],
      // จ่าย 2 งวด = 2,000 → เหลือผ่อน 4,000 · ต้นสัดส่วน = 5,000 × 4,000/6,000 ≈ 3,333.33
      pays: [
        {
          index: 0,
          amount: 2000,
          paidDate: addDays(today, -2),
          note: 'ตัวอย่าง: จ่ายไป 2 งวด',
        },
      ],
    },
    {
      name: 'ประยุทธ์ เงินดี',
      phone: '083-444-5566',
      lineId: 'prayut.ngd',
      note: SEED_TAG,
      creditNote: 'ลูกค้ายอดใหญ่ — มี 2 สัญญา',
      emergencyContacts: [
        {
          name: 'ปรียา เงินดี',
          phone: '083-444-5577',
          line: 'priya.ngd',
          note: 'ภรรยา',
        },
        {
          name: 'ประเสริฐ เงินดี',
          phone: '083-444-5588',
          note: 'ลูกชาย',
        },
      ],
      loans: [
        {
          principalOriginal: 50000,
          outstandingPrincipal: 50000,
          interestRatePercent: 2,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'กู้ 50,000 · ดอก 2%/วัน = 1,000',
        },
        {
          principalOriginal: 15000,
          outstandingPrincipal: 15000,
          interestRatePercent: 5,
          cycle: 'TEN_DAY',
          interestMode: 'FLAT',
          startDate: addDays(today, -3),
          note: 'กู้ 15,000 · ดอกคงที่ 5%/10วัน = 750 · ยังไม่ครบรอบ (อีก 7 วัน)',
        },
      ],
    },
    {
      name: 'เอกชัย ห่างหาย',
      phone: '084-777-8899',
      lineId: 'ekachai.hh',
      note: SEED_TAG,
      creditNote: 'เคยขาดการติดต่อ — มีทั้งยอดตายและหนี้สูญไว้ทดสอบเปิดคืน',
      emergencyContacts: [
        {
          name: 'เอมอร ห่างหาย',
          phone: '084-777-8800',
          line: 'aemon.hh',
          note: 'พี่สาว',
        },
      ],
      loans: [
        {
          // ยอดตาย: กู้ 12,000 หยุดดอก ตรึงยอด ทยอยคืน 500/10วัน
          principalOriginal: 12000,
          outstandingPrincipal: 12000,
          interestRatePercent: 2,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          startDate: addDays(today, -30),
          note: 'เคยขาดติดต่อ → แปลงเป็นยอดตาย (ตรึง 12,000)',
          after: { dead: { installmentAmount: 500 } },
        },
        {
          // หนี้สูญ: กู้ 8,000 ตัดหนี้สูญไปแล้ว (ไว้ทดสอบเปิดยอดคืน)
          principalOriginal: 8000,
          outstandingPrincipal: 8000,
          interestRatePercent: 2,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          startDate: addDays(today, -60),
          note: 'ขาดติดต่อยาว → ตัดหนี้สูญ (ตรึงขาดทุน 8,000)',
          after: { writeOff: { reason: 'ขาดการติดต่อเกิน 2 เดือน' } },
        },
      ],
    },
  ];

  for (const person of people) {
    const { loans, pays, ...debtorBody } = person;
    const debtor = await api(token, '/debtors', {
      method: 'POST',
      body: debtorBody,
    });
    console.log(`+ ลูกหนี้ ${debtor.name}`);

    const createdLoans = [];
    for (const loanBody of loans) {
      const { after, ...body } = loanBody;
      let loan = await api(token, '/loans', {
        method: 'POST',
        body: { debtorId: debtor.id, ...body },
      });
      createdLoans.push(loan);
      const hint =
        loan.status === 'INSTALLMENT'
          ? `ผ่อน ${loan.installmentAmount}/งวด · คงเหลือ ${loan.deadBalance}`
          : `ต้น ${loan.outstandingPrincipal} · ค้าง ${loan.arrears} · ดอก ${loan.interestRatePercent}%`;
      console.log(`  └ ${loan.contractNumber} · ${loan.status} · ${hint}`);

      // แปลงเป็นยอดตาย / ตัดหนี้สูญ เพื่อให้มีตัวอย่างทุกสถานะไว้ทดสอบ
      if (after?.dead) {
        loan = await api(token, `/loans/${loan.id}/dead`, {
          method: 'POST',
          body: after.dead.installmentAmount
            ? { installmentAmount: after.dead.installmentAmount }
            : {},
        });
        createdLoans[createdLoans.length - 1] = loan;
        console.log(
          `    → แปลงเป็นยอดตาย · ตรึง ${loan.deadBalance}${
            loan.installmentAmount ? ` · ผ่อน ${loan.installmentAmount}/10วัน` : ''
          }`,
        );
      }
      if (after?.writeOff) {
        loan = await api(token, `/loans/${loan.id}/write-off`, {
          method: 'POST',
          body: { reason: after.writeOff.reason ?? 'ลูกค้าขาดการติดต่อ' },
        });
        createdLoans[createdLoans.length - 1] = loan;
        console.log(`    → ตัดหนี้สูญ (${after.writeOff.reason ?? 'ขาดติดต่อ'})`);
      }
    }

    for (const pay of pays ?? []) {
      const loan = createdLoans[pay.index];
      const { index: _i, ...body } = pay;
      const payment = await api(token, '/payments', {
        method: 'POST',
        body: { loanId: loan.id, ...body },
      });
      console.log(`  └ จ่าย ฿${payment.amount} (${payment.note ?? ''})`);
    }

    // รีเฟรชยอดหลังจ่าย เพื่อตรวจตัวเลข
    for (let i = 0; i < createdLoans.length; i++) {
      const loan = await api(token, `/loans/${createdLoans[i].id}`);
      if (loan.status === 'INSTALLMENT') {
        console.log(
          `  └ หลังจ่าย → ต้น ${loan.outstandingPrincipal} · ผ่อนคงเหลือ ${loan.deadBalance}`,
        );
      } else if ((pays ?? []).some((p) => p.index === i)) {
        console.log(
          `  └ หลังจ่าย → ต้น ${loan.outstandingPrincipal} · ค้าง ${loan.arrears}`,
        );
      }
    }
  }

  const dash = await api(token, '/dashboard/today');
  console.log('');
  console.log('—— เก็บวันนี้ ——');
  console.log(
    `วันที่ ${dash.date} · ${dash.items.length} รายการ · ยอดเปิดทั้งหมด ${dash.allOpen}`,
  );
  for (const i of dash.items) {
    console.log(
      ` · ${i.debtorName} | เก็บวันนี้ ${i.remainingToday} | ค้าง ${i.arrears} | จ่ายแล้ว ${i.paidToday} | ${i.status}`,
    );
  }

  console.log('');
  console.log('—— สรุปตัวเลขที่ควรเห็น ——');
  console.log(' สมชาย: ต้นเหลือ 9,000 (หลังตัด 1,000) · จ่ายดอกครบวันนี้');
  console.log(' มาลี: ดอกคงที่ครบรอบ 900');
  console.log(' วิชัย: ค้าง 540 + ดอกวันนี้ 270 = เก็บ 810 · ต้น 18,000');
  console.log(' นภา: ผ่อนเหลือ 4,000 (จ่ายไป 2/6) · ต้นสัมพันธ์ ≈ 3,333.33');
  console.log(' ประยุทธ์: ดอกวันนี้ 1,000 (+ สัญญา 10 วันยังไม่ครบรอบ)');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
