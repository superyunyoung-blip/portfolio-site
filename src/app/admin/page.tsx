import Link from "next/link";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-blue-600">
          공개 사이트 보기
        </Link>
        <div className="mt-8">
          <AdminDashboard />
        </div>
      </div>
    </main>
  );
}
