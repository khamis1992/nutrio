import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  onExpire: () => void;
}

export function CountdownTimer({ initialSeconds, onExpire }: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      setSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, onExpire]);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <span className={seconds < 30 ? 'text-red-600 font-medium' : ''}>
      {minutes}:{remainingSeconds.toString().padStart(2, '0')}
    </span>
  );
}
