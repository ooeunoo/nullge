import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Nullge Console',
  description: 'Nullge 제품의 콘텐츠를 만들고 검토하는 운영 공간',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
