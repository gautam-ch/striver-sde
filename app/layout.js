import "./globals.css";

export const metadata = {
  title: "Striver's SDE Sheet - Top Coding Interview Problems",
  description: "The classic Striver's SDE Sheet containing hand-picked top coding interview questions from different topics of Data Structures & Algorithms with local browser persistence.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
