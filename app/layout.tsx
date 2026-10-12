import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import ToastProvider from "./components/toast-provider";
import Navbar from "./components/navbar";
import AuthProvider from "./components/auth-provider";
import LoginGateProvider from "./components/login-gate";
import { getCurrentUser } from "./lib/supabase/server";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "รด.แดนซ์",
  description: "ฝึกให้ถูกต้อง พัฒนาให้ดีกว่า",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ผู้ใช้ที่ล็อกอินอยู่ (อ่านจาก cookie ฝั่งเซิร์ฟเวอร์ ไม่กระพริบตอนโหลดหน้า)
  const current = await getCurrentUser();
  const auth = {
    user: current ? { id: current.id, email: current.email } : null,
    profile: current?.profile ?? null,
  };

  return (
    <html lang="th" className={kanit.variable}>
      <body>
        <AuthProvider value={auth}>
          <LoginGateProvider>
            <ToastProvider>
              <Navbar />
              <main>{children}</main>
            </ToastProvider>
          </LoginGateProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
