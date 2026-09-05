import { Suspense } from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-100 overflow-y-auto">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center p-6 text-slate-700">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-xs font-mono font-medium tracking-wide">LOADING AUTH PORTAL...</p>
        </div>
      }>
        {children}
      </Suspense>
    </div>
  );
}