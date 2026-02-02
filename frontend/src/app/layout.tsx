// app/layout.tsx
import 'tailwindcss/tailwind.css';
import '../styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from '../contexts/AuthContext';
import { TranslationProvider } from '../contexts/TranslationContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <TranslationProvider>
            {children}
          </TranslationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}