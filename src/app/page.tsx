export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Phase 1 Foundation Ready
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          KASI Agri Agencies Management System
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Core architectural foundation initialized. Ready for Phase 2 domain modules.
        </p>
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-500 font-mono">
          <div>Framework: Next.js (App Router) + TypeScript</div>
          <div>Styling: Tailwind CSS v4</div>
          <div>Database: Mongoose Singleton Cache</div>
          <div>Validation: Zod Runtime Schema</div>
        </div>
      </div>
    </main>
  );
}

