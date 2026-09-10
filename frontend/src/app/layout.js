import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "V-DOCKX | Vision-Guided Autonomous Docking & Telemetry",
  description: "Next-generation autonomous robot docking, vision-guided alignment, safety corridor monitoring, and telemetry cockpit.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0e11] text-[#f0f2f5]">
        {children}
      </body>
    </html>
  );
}
