import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WordSwarm AI Dashboard",
  description: "Watch the AI agent play WordSwarm",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
