import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '모임 — 회사 앞 식당 지도',
  description: 'SK서린빌딩 주변, 법인카드 실적 기반 식당 추천',
};

export const viewport: Viewport = {
  themeColor: '#E11D48',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="color-scheme" content="light only" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-slate-100 min-h-screen"
        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        <div className="max-w-[480px] mx-auto min-h-screen bg-slate-50 shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
