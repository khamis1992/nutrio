import { useState } from "react";

import {
  getExerciseAnimationUrl,
  getExerciseImageUrl,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";

interface ExerciseMediaProps {
  exercise: ExerciseCatalogItem;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function ExerciseMedia({
  exercise,
  alt,
  className,
  loading = "eager",
}: ExerciseMediaProps) {
  const animation = getExerciseAnimationUrl(exercise);
  const staticImage = getExerciseImageUrl(exercise);
  const [failedAnimation, setFailedAnimation] = useState<string | null>(null);
  const source = animation && failedAnimation !== animation ? animation : staticImage;

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
