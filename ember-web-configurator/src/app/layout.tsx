import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ember Web-Configurator',
  description: 'Web-Configurator for "Ember". Ember is 32Key Hall Effect Keyboard for Gaming.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body>{children}</body>
    </html>
  );
}
