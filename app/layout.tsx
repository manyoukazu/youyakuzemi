import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ヨウヤクゼミ | 発表を聴く。その場で、わかる。",
  description: "学会・ゼミの発表をリアルタイムで収音。背景、目的、手法、結論を、やさしい日本語でセクションごとに要約します。",
  icons: {
    icon: "/cicada.png",
    shortcut: "/cicada.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
