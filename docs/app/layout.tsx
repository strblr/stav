import { type ReactNode } from "react";
import { Inter } from "next/font/google";
import { Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "./globals.css";

export const metadata = {};

const inter = Inter({
  subsets: ["latin"]
});

const navbar = (
  <Navbar
    logo={<b className="font-bold text-xl">Stav</b>}
    projectLink="https://github.com/strblr/stav"
  />
);

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={inter.className}
    >
      <Head
        color={{
          hue: 0,
          saturation: 0,
          lightness: {
            light: 44,
            dark: 100
          }
        }}
        backgroundColor={{
          light: "#FFF",
          dark: "#09090a"
        }}
      />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/strblr/stav/tree/main/docs"
          nextThemes={{ defaultTheme: "dark" }}
          sidebar={{ toggleButton: false }}
          toc={{
            extraContent: (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                MIT {new Date().getFullYear()} © Stav.
              </span>
            )
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
