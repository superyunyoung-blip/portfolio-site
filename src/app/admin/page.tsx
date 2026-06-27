import Link from "next/link";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <main className="pastel-page min-h-screen px-6 py-10 text-[#3f2a56]">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold text-[#9f7aea]">
          공개 사이트 보기
        </Link>
        <div className="mt-8">
          <AdminDashboard />
        </div>
      </div>
    </main>
  );
}
