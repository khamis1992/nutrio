import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  Navigation, 
  Layers,
  Filter,
  Map as MapIcon
} from 'lucide-react';

interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCenter?: () => void;
  onToggleLayer?: () => void;
  onToggleFilter?: () => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onCenter,
  onToggleLayer,
  onToggleFilter,
}: MapControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      {onZoomIn && (
        <Button
          variant="secondary"
          size="icon"
          onClick={onZoomIn}
          className="shadow-lg bg-white/90 backdrop-blur"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      )}
      
      {onZoomOut && (
        <Button
          variant="secondary"
          size="icon"
          onClick={onZoomOut}
          className="shadow-lg bg-white/90 backdrop-blur"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      )}

      {onCenter && (
        <Button
          variant="secondary"
          size="icon"
          onClick={onCenter}
          className="shadow-lg bg-white/90 backdrop-blur"
          title="Center on city"
        >
          <Navigation className="h-4 w-4" />
        </Button>
      )}

      {onToggleLayer && (
        <Button
          variant="secondary"
          size="icon"
          onClick={onToggleLayer}
          className="shadow-lg bg-white/90 backdrop-blur"
          title="Toggle map layer"
        >
          <Layers className="h-4 w-4" />
        </Button>
      )}

      {onToggleFilter && (
        <Button
          variant="secondary"
          size="icon"
          onClick={onToggleFilter}
          className="shadow-lg bg-white/90 backdrop-blur"
          title="Filter drivers"
        >
          <Filter className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
