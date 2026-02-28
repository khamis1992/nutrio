import type { DriverLocation } from '@/fleet/types/fleet';

interface DriverMarkerProps {
  driver: DriverLocation;
  isSelected?: boolean;
  onClick?: () => void;
}

export function DriverMarker({ driver, isSelected, onClick }: DriverMarkerProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer transform transition-transform hover:scale-110
        ${isSelected ? 'scale-125 z-10' : 'z-0'}
      `}
    >
      {/* Marker Pin */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          shadow-lg border-2 transition-all duration-200
          ${driver.isOnline 
            ? 'bg-green-500 border-white' 
            : 'bg-gray-400 border-white'
          }
          ${isSelected ? 'ring-4 ring-primary/30' : ''}
        `}
      >
        <svg 
          className="w-5 h-5 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 10V3L4 14h7v7l9-11h-7z" 
          />
        </svg>
      </div>

      {/* Pulse Animation for Online Drivers */}
      {driver.isOnline && (
        <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />
      )}

      {/* Driver Info Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
          <p className="font-medium text-sm">{driver.driverName}</p>
          <p className={`text-xs ${driver.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
            {driver.isOnline ? '● Online' : '● Offline'}
          </p>
          {driver.speed !== undefined && driver.speed > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(driver.speed)} km/h
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
