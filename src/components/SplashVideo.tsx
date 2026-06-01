import React, { useEffect, useRef, useState } from 'react';
import { isNative } from '@/lib/capacitor';

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

  // On Capacitor (APK/IPA) the base is './' so assets are at './splash.mp4'.
  // On Vercel web the base is '/nutrio/' so the path is '/nutrio/splash.mp4'.
  // Using a relative path './splash.mp4' works for both when the video is in
  // the dist root, but the safest approach is to check the platform.
  const splashSrc = isNative ? './splash.mp4' : '/nutrio/splash.mp4';

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex items-center justify-center transition-opacity duration-600 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src={splashSrc}
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
