import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import ReactQueryProvider from "@/src/components/providers/ReactQueryProvider";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
    title: "ZedXe",
    description: "Track real-time stock prices, get personalized alerts and explore detailed company insights.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark scroll-smooth">
        <body
            className={`${inter.variable} antialiased`}
        >
        <ReactQueryProvider>
            {children}
            <Toaster />
        </ReactQueryProvider>
        </body>
        </html>
    );
}
