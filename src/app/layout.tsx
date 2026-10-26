import type { Metadata } from "next";
import { Albert_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Markenschriften für digitale Produkte (NEONEX Design System):
// Inter für die Oberfläche, Albert Sans als Ersatz für Soleil, JetBrains Mono für Zahlen.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEONEX Line Balancing",
  description: "Line Balancing und Yamazumi für Workshops",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${albertSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
