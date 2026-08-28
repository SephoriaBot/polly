interface CheckMarkProps {
  completed: boolean;
  size?: number;
  className?: string;
}

export default function CheckMark({ completed, size = 22, className }: CheckMarkProps) {
  return (
    <span
      className={`theme-check ${completed ? 'theme-check--full' : 'theme-check--empty'}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    />
  );
}
