import "../styles/globals.css";
import { ReactNode } from "react";
import { Metadata } from "next";
import Providers from "@/utils/providers/providers";
import Background from "@/components/UI/Background";

interface RootLayoutProps {
  children: ReactNode;
}


export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, height=device-height" />
      </head>
      <body className="text-white relative max-h-screen overflow-x-hidden">
        <Background />
        <div className="relative z-10 h-full">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
