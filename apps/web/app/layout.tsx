import "./globals.css";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata = {
  title: "Capture AI Agent",
  description: "Capture AI MVP for inboxed screenshots",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={spaceGrotesk.variable}>
        <div className="app-shell">
          <header className="app-header">
            <div>
              <p className="eyebrow">Capture AI Agent</p>
              <h1>캡처 인입함</h1>
            </div>
            <nav className="app-nav">
              <a href="/inbox">Inbox</a>
              <a href="/chat">Chat</a>
              <a href="/todos">Todos</a>
              <a href="/settings">Settings</a>
              <a href="/chrome-test">Chrome Test</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
