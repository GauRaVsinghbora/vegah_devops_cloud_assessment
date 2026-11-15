import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartURL — URL Shortener & Analytics',
  description: 'Create smart short links and understand every click.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
