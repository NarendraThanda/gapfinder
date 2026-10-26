import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapFinder AI — Find What You Don't Know",
  description: "GapFinder AI analyzes your study materials, finds your knowledge gaps, and builds a personalized revision plan. Stop studying what you already know.",
  keywords: ["study", "AI", "gap analysis", "revision", "exam preparation", "personalized learning"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Animated background */}
        <div className="bg-animated">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
        </div>

        <div className="relative z-10 flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
