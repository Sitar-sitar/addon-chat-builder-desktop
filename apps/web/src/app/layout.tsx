import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./styles.css";

// DotGothic16（日本語ピクセル）は next/font/google が日本語サブセットを配信しないため、
// styles.css の @import（Google Fonts の unicode-range 配信）で読み込む。
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press"
});

export const metadata: Metadata = {
  title: "Addon Chat Builder",
  description: "ChatGPT API と対話しながら Minecraft Bedrock アドオンを作るローカルアプリ"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={pressStart.variable}>
      <body>{children}</body>
    </html>
  );
}
