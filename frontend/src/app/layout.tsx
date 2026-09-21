import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-fc-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sans = Inter({
  variable: "--font-fc-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FlashCard Angkatan",
    template: "%s · FlashCard Angkatan",
  },
  description:
    "Aplikasi flashcard untuk mengingat nama mahasiswa satu angkatan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}