import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Speak to Copy — Voice to Text",
  description: "Speak to Copy — tap the mic and speak; your words are captured continuously in 21 languages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
