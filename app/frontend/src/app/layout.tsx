import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import DateRangeProvider from "../components/DateRangeProvider";
import AnalysisProvider from "../components/AnalysisProvider";
import AnalysisControls from "../components/AnalysisControls";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Runsight",
  description: "Running data and insights.",
  icons: {
    icon: { url: "/images/logo.png", type: "image/png" },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <DateRangeProvider>
        <AnalysisProvider>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main id="main-content" className="min-w-0 flex-1 p-6 md:p-10">
              {children}
              <AnalysisControls />
            </main>
          </div>
        </div>
        </AnalysisProvider>
        </DateRangeProvider>
      </body>
    </html>
  );
}
