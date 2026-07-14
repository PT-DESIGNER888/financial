/**
 * ใส่ข้อมูลตัวอย่างสัมพันธ์กัน ~5 ลูกหนี้ + ยอดกู้/การจ่าย
 * ให้ขึ้นหน้า "เก็บวันนี้" ได้จริง
 *
 * ใช้: node scripts/seed-demo.mjs
 * ต้องรัน API ที่ localhost:3001 แล้ว
 */
const BASE = process.env.API_URL ?? 'http://localhost:3001';

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
  console.log(`API ${BASE} · วันนี้ (Bangkok) = ${today}`);

  const login = await api(null, '/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin1234' },
  });
  const token = login.accessToken;

  const existing = await api(token, '/debtors');
  const already = existing.some((d) => d.note === 'DEMO_SEED_v1');
  if (already) {
    console.log('มีข้อมูล DEMO_SEED_v1 อยู่แล้ว — ข้ามการสร้างซ้ำ');
    const todayDash = await api(token, '/dashboard/today');
    console.log(`เก็บวันนี้: ${todayDash.items.length} รายการ`);
    return;
  }

  // —— 5 ลูกหนี้ ที่เกี่ยวกับกันในพอร์ตเดียวกัน ——
  const people = [
    {
      name: 'สมชาย จันทร์เพ็ญ',
      phone: '081-234-5678',
      lineId: 'somchai.j',
      note: 'DEMO_SEED_v1',
      loans: [
        {
          // ดอกรายวัน — ยอดเก่า → due วันนี้
          principalOriginal: 10000,
          outstandingPrincipal: 10000,
          interestRatePercent: 1,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'ยอดประจำวัน — ต้องเก็บดอกวันนี้',
        },
      ],
      pay: { index: 0, amount: 50 }, // จ่ายบางส่วนวันนี้
    },
    {
      name: 'มาลี ศรีสุข',
      phone: '089-111-2233',
      facebookUrl: 'https://facebook.com/malee.srisuk',
      note: 'DEMO_SEED_v1',
      loans: [
        {
          // ราย 10 วันครบรอบวันนี้
          principalOriginal: 30000,
          outstandingPrincipal: 30000,
          interestRatePercent: 3,
          cycle: 'TEN_DAY',
          interestMode: 'FLAT',
          startDate: addDays(today, -10),
          note: 'ยอด 10 วัน — ครบรอบวันนี้',
        },
      ],
    },
    {
      name: 'วิชัย พูนผล',
      phone: '062-555-7788',
      note: 'DEMO_SEED_v1',
      loans: [
        {
          // มียอดค้างดอกเก่า
          principalOriginal: 20000,
          outstandingPrincipal: 18000,
          arrears: 450,
          interestRatePercent: 1.5,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'ตัดต้นไปแล้วบางส่วน + ดอกค้าง',
        },
      ],
    },
    {
      name: 'นภา อรุณรุ่ง',
      phone: '086-999-0001',
      lineId: 'napha.arun',
      note: 'DEMO_SEED_v1',
      loans: [
        {
          // ผ่อนสินค้า เปิดมา 3 วันแล้ว → มีงวดค้าง
          type: 'INSTALLMENT',
          principalOriginal: 5000,
          installmentTotal: 6000,
          installmentCount: 6,
          cycle: 'DAILY',
          startDate: addDays(today, -3),
          note: 'ผ่อนมือถือ 6 งวด',
        },
      ],
    },
    {
      name: 'ประยุทธ์ เงินดี',
      phone: '083-444-5566',
      note: 'DEMO_SEED_v1',
      loans: [
        {
          principalOriginal: 50000,
          outstandingPrincipal: 50000,
          interestRatePercent: 2,
          cycle: 'DAILY',
          interestMode: 'FLOATING',
          note: 'ยอดใหญ่รายวัน',
        },
        {
          // คนเดียวกัน — อีกยอดราย 10 วัน ยังไม่ครบรอบ (ไม่ขึ้นวันนี้)
          principalOriginal: 15000,
          outstandingPrincipal: 15000,
          interestRatePercent: 5,
          cycle: 'TEN_DAY',
          interestMode: 'FLAT',
          startDate: addDays(today, -3),
          note: 'ยอด 10 วัน — ยังไม่ครบรอบ (อีก 7 วัน)',
        },
      ],
    },
  ];

  for (const person of people) {
    const { loans, pay, ...debtorBody } = person;
    const debtor = await api(token, '/debtors', {
      method: 'POST',
      body: debtorBody,
    });
    console.log(`+ ลูกหนี้ ${debtor.name}`);

    const createdLoans = [];
    for (const loanBody of loans) {
      const loan = await api(token, '/loans', {
        method: 'POST',
        body: { debtorId: debtor.id, ...loanBody },
      });
      createdLoans.push(loan);
      console.log(
        `  └ ยอด ${loan.contractNumber ?? loan.id.slice(0, 8)} · ${loan.status} · ต้น ${loan.principalOriginal}`,
      );
    }

    if (pay) {
      const loan = createdLoans[pay.index];
      const payment = await api(token, '/payments', {
        method: 'POST',
        body: {
          loanId: loan.id,
          amount: pay.amount,
          note: 'ตัวอย่างจ่ายบางส่วนวันนี้',
        },
      });
      console.log(`  └ จ่ายแล้ววันนี้ ฿${payment.amount}`);
    }
  }

  const dash = await api(token, '/dashboard/today');
  console.log('');
  console.log('—— เก็บวันนี้ ——');
  console.log(`วันที่ ${dash.date} · ${dash.items.length} รายการ · ยอดเปิดทั้งหมด ${dash.allOpen}`);
  for (const i of dash.items) {
    console.log(
      ` · ${i.debtorName} | เหลือวันนี้ ${i.remainingToday} | ค้าง ${i.arrears} | จ่ายแล้ว ${i.paidToday} | ${i.status}`,
    );
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
