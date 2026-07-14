import Image from 'next/image';

const sizes = {
  sm: { box: 'size-9', img: 36 },
  md: { box: 'size-10', img: 40 },
  lg: { box: 'size-14', img: 56 },
  xl: { box: 'size-[4.5rem]', img: 72 },
} as const;

/** โลโก้วอลเล็ตโปร่งใส — ไม่ใส่พื้นสี่เหลี่ยมสี เพราะตัวโลโก้เป็นสีอยู่แล้ว */
export function BrandLogo({
  size = 'md',
  className = '',
  priority,
}: {
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
}) {
  const s = sizes[size];
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${s.box} ${className}`}
    >
      <Image
        src="/logo.png"
        alt="โลโก้ระบบเงินกู้"
        width={s.img}
        height={s.img}
        className="object-contain"
        priority={priority}
      />
    </span>
  );
}
