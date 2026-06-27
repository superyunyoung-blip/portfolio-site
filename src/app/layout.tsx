import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import "./globals.css";

const roundedFont = Gaegu({
  variable: "--font-rounded",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Portfolio CMS",
  description: "관리자가 직접 글과 프로젝트를 관리하는 포트폴리오 사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={roundedFont.variable}>
      <body>{children}</body>
    </html>
  );
}
