import { useState } from "react";

import {
  getExerciseAnimationUrl,
  getExerciseImageUrl,
  getExerciseVideoUrl,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";

interface ExerciseMediaProps {
  exercise: ExerciseCatalogItem;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  preferVideo?: boolean;
}

export function ExerciseMedia({
  exercise,
  alt,
  className,
  loading = "eager",
  preferVideo = false,
}: ExerciseMediaProps) {
  const video = getExerciseVideoUrl(exercise);
  const animation = getExerciseAnimationUrl(exercise);
  const staticImage = getExerciseImageUrl(exercise);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const [failedAnimation, setFailedAnimation] = useState<string | null>(null);
  const source = animation && failedAnimation !== animation ? animation : staticImage;

  if (preferVideo && video && failedVideo !== video) {
    return (
      <video
        key={video}
        src={video}
        poster={source || undefined}
        autoPlay
        loop
        controls
        muted
        playsInline
        preload="metadata"
        onError={() => setFailedVideo(video)}
        className={className}
      />
    );
  }

  return (
    <img
      src={source || undefined}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (animation) setFailedAnimation(animation);
      }}
      className={className}
    />
  );
}
