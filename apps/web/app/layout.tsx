import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lacuna",
  description: "Find out what your agent's rules actually permit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
