import React, { useEffect, useRef, useState } from 'react';

interface SplashVideoProps {
  onComplete: () => void;
}

export const SplashVideo: React.FC<SplashVideoProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);

  const finish = () => {
    if (fading) return;
    setFading(true);
    setTimeout(onComplete, 600);
  };

  useEffect(() => {
    // Safety fallback: complete after 8 seconds no matter what
    const timeout = setTimeout(finish, 8000);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex items-center justify-center transition-opacity duration-600 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src="/nutrio/splash.mp4"
        autoPlay
        playsInline
        onEnded={finish}
        onError={finish}
        className="w-full h-full object-contain"
      />
      <button
        onClick={finish}
        className="absolute bottom-10 right-6 px-4 py-1.5 rounded-full bg-black/10 text-gray-600 text-sm backdrop-blur-sm"
      >
        Skip
      </button>
    </div>
  );
};

export default SplashVideo;
