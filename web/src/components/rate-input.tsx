'use client';

import { Segmented, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import {
  bahtToPercent,
  interestBaht,
  MAX_RATE_PERCENT,
  rateLooksWrong,
  type RateUnit,
} from '@/lib/interest';

/**
 * ช่องกรอกดอกต่อรอบ — กรอกเป็น % หรือเป็นบาทก็ได้ (ระบบเก็บเป็น % เสมอ)
 * โชว์อีกหน่วยให้เห็นตลอดเวลา และเตือนเมื่อดอกสูงผิดปกติจนน่าจะสลับหน่วยกัน
 */
export function RateInput({
  base,
  unit,
  onUnitChange,
  value,
  onChange,
  label = 'ดอกต่อรอบ *',
}: {
  /** ฐานคำนวณดอก — ต้นเดิม (ดอกคงที่) หรือต้นคงเหลือ (ดอกลอย) */
  base: number;
  unit: RateUnit;
  onUnitChange: (u: RateUnit) => void;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const typed = parseFloat(value) || 0;
  const percent = unit === 'PERCENT' ? typed : bahtToPercent(base, typed);
  const perCycle = interestBaht(base, percent);
  const filled = value.trim() !== '' && typed > 0;
  const overMax = percent > MAX_RATE_PERCENT;

  /** สลับหน่วยแล้วแปลงตัวเลขตาม — ดอกที่ตกลงจริงต้องไม่เปลี่ยนเพราะกดสลับ */
  const switchUnit = (next: RateUnit) => {
    if (next === unit) return;
    if (filled && base > 0) {
      onChange(
        String(next === 'BAHT' ? perCycle : bahtToPercent(base, typed)),
      );
    }
    onUnitChange(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-600 md:text-[15px] dark:text-gray-300">
          {label}
        </label>
        <Segmented
          value={unit}
          onChange={switchUnit}
          options={[
            { value: 'PERCENT', label: '%' },
            { value: 'BAHT', label: 'บาท' },
          ]}
        />
      </div>
      <TextInput
        type="number"
        step={unit === 'PERCENT' ? '0.001' : '1'}
        inputMode="decimal"
        align="right"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={unit === 'PERCENT' ? 'เช่น 20' : 'เช่น 100'}
      />

      {filled && base > 0 && (
        <p className="mt-1.5 text-[13px] text-slate-500 dark:text-gray-400">
          {unit === 'PERCENT' ? (
            <>
              = เก็บดอกรอบละ{' '}
              <b className="text-slate-700 dark:text-gray-200">
                ฿{baht(perCycle)}
              </b>{' '}
              (จากต้น ฿{baht(base)})
            </>
          ) : (
            <>
              = <b className="text-slate-700 dark:text-gray-200">{percent}%</b>{' '}
              ของต้น ฿{baht(base)} ต่อรอบ
            </>
          )}
        </p>
      )}

      {filled && overMax && (
        <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
          ดอกต่อรอบสูงเกินกว่าที่ระบบเก็บได้ ({MAX_RATE_PERCENT}% ของต้น)
        </p>
      )}

      {filled && !overMax && rateLooksWrong(base, percent) && (
        <p className="mt-1.5 rounded-lg bg-amber-50 p-2.5 text-[13px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          ดอกรอบละ ฿{baht(perCycle)} คิดเป็น {percent}% ของต้น — สูงผิดปกติ
          {unit === 'PERCENT' && (
            <>
              {' '}
              ถ้าตั้งใจจะเก็บ <b>฿{baht(typed)}</b> ต่อรอบ ให้กด
              &ldquo;บาท&rdquo; แล้วกรอก {baht(typed)} ใหม่
            </>
          )}
        </p>
      )}
    </div>
  );
}
