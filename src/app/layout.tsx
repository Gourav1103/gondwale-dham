import type { Metadata, Viewport } from "next";
import { Noto_Sans_Devanagari, Noto_Serif_Devanagari, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });
const devaSans = Noto_Sans_Devanagari({ variable: "--font-deva-sans", subsets: ["devanagari"] });
const devaSerif = Noto_Serif_Devanagari({ variable: "--font-deva-serif", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: { default: "Harihaat 2026 · Decoration Planning", template: "%s · Harihaat 2026" },
  description: "Decoration ideas and 51 Shakti Peeth planning for Harihaat 2026, गोंदवले धाम, इंदौर.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fcfaf6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hi"
      className={`${jakarta.variable} ${playfair.variable} ${devaSans.variable} ${devaSerif.variable} h-full antialiased`}
    >
      <body className="app-bg min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
