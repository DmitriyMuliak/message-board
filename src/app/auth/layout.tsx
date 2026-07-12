interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <main className="flex min-h-screen flex-col bg-paper md:flex-row">{children}</main>;
}
