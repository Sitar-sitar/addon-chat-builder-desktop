import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Addon Chat Builder",
  description: "ChatGPT API と対話しながら Minecraft Bedrock アドオンを作るローカルアプリ"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

