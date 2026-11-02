import { cn } from "@/lib/utils/cn";

/* State komponen: loading (skeleton), kosong, dan error — reusable. */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />;
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-brand-300">{icon}</div>}
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, action }: { message?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-medium">Terjadi kesalahan</p>
      <p className="mt-1">{message ?? "Coba lagi atau periksa koneksi internet Anda."}</p>
      {action}
    </div>
  );
}
