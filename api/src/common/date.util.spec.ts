import { addDays, addMonths, diffDays, todayStr } from './date.util';

describe('date.util', () => {
  describe('addDays', () => {
    it('บวกวันข้ามเดือน', () => {
      expect(addDays('2024-01-01', 31)).toBe('2024-02-01');
    });

    it('รองรับค่าติดลบ', () => {
      expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 อธิกสุรทิน
    });

    it('บวก 0 วันได้ค่าเดิม', () => {
      expect(addDays('2024-07-16', 0)).toBe('2024-07-16');
    });
  });

  describe('addMonths', () => {
    it('บวกเดือนแบบตรึงวันที่', () => {
      expect(addMonths('2024-01-15', 1)).toBe('2024-02-15');
    });

    it('ปลายเดือนสั้นกว่า → ใช้วันสุดท้ายของเดือน (leap year)', () => {
      expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    });

    it('ปลายเดือนสั้นกว่า → ใช้วันสุดท้ายของเดือน (non-leap)', () => {
      expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    });

    it('ข้ามปี', () => {
      expect(addMonths('2023-12-10', 1)).toBe('2024-01-10');
    });
  });

  describe('diffDays', () => {
    it('นับส่วนต่างวันภายในเดือน', () => {
      expect(diffDays('2024-01-01', '2024-01-31')).toBe(30);
    });

    it('ค่าเป็นลบเมื่อ to อยู่ก่อน from', () => {
      expect(diffDays('2024-01-31', '2024-01-01')).toBe(-30);
    });

    it('วันเดียวกัน = 0', () => {
      expect(diffDays('2024-05-05', '2024-05-05')).toBe(0);
    });
  });

  describe('todayStr', () => {
    it('คืนรูปแบบ YYYY-MM-DD', () => {
      expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
