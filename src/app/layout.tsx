import type { Metadata } from "next";
import localFont from "next/font/local";
import "./styles/globals.css";
import NavigationMenu from "@/components/navigation-menu";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="h-dvh w-dvw flex flex-col">
          <NavigationMenu />
          <main className="h-full w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
