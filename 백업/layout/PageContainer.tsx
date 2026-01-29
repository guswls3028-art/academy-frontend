interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: Props) {
  return (
    <main className={`flex-1 p-6 ${className}`}>
      {children}
    </main>
  );
}
