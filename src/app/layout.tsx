import type { Metadata } from 'next';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import './globals.css';
import './revision.css';
export const metadata: Metadata = {
  title: 'Terbang melesat, Lanjakke nian | United Tractors Palembang',
  description: 'Registrasi dan door prize Family Gathering United Tractors Palembang.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><a className="skip-link" href="#main-content">Lewati ke konten</a><div id="main-content">{children}</div></body></html>;
}
