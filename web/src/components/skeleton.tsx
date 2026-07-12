/** โครงหน้าระหว่างโหลด — แทน spinner/ข้อความ ตามแนวทาง product UI */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-label="กำลังโหลด" role="status">
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
      <div className="h-64 rounded-lg bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
