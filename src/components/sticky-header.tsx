import { cn } from '@/lib/utils';

// Sahifa tepasi (sarlavha, tugmalar, oy tanlash, filtrlar) aylantirganda qotib turadi.
// Aylanuvchi konteyner — layout'dagi <main> (p-4 md:p-6): manfiy margin bilan uning padding'i qoplanadi,
// shunda fon chetidan-chetigacha boradi va ostidan kontent ko'rinmaydi. Sahifa ildizidagi birinchi element bo'lishi kerak
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-4 -mt-4 space-y-3 border-b bg-background/95 px-4 pt-4 pb-3 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 md:pt-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
