interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: Props) {
  return (
    <div className={`p-6 w-full ${className}`}>
      {children}
    </div>
  );
}
