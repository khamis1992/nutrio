import { Flame } from "lucide-react";

interface CalorieProgressRingProps {
  consumed: number;
  target: number;
}

const CalorieProgressRing = ({ consumed, target }: CalorieProgressRingProps) => {
  const totalSegments = 40;
  const progress = Math.min(consumed / target, 1);
  const filledSegments = Math.round(progress * totalSegments);
  
  const segments = [];
  const radius = 90;
  const centerX = 100;
  const centerY = 100;
  const segmentGap = 3; // degrees
  const segmentArc = (360 / totalSegments) - segmentGap;
  
  for (let i = 0; i < totalSegments; i++) {
    const startAngle = i * (360 / totalSegments) - 90; // Start from top
    const endAngle = startAngle + segmentArc;
    const isFilled = i < filledSegments;
    
    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate arc points
    const innerRadius = 70;
    const outerRadius = radius;
    
    const x1 = centerX + outerRadius * Math.cos(startRad);
    const y1 = centerY + outerRadius * Math.sin(startRad);
    const x2 = centerX + outerRadius * Math.cos(endRad);
    const y2 = centerY + outerRadius * Math.sin(endRad);
    const x3 = centerX + innerRadius * Math.cos(endRad);
    const y3 = centerY + innerRadius * Math.sin(endRad);
    const x4 = centerX + innerRadius * Math.cos(startRad);
    const y4 = centerY + innerRadius * Math.sin(startRad);
    
    const largeArcFlag = segmentArc > 180 ? 1 : 0;
    
    const path = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
      Z
    `;
    
    segments.push(
      <path
        key={i}
        d={path}
        className={`transition-all duration-300 ${
          isFilled 
            ? 'fill-warning' 
            : 'fill-muted'
        }`}
        style={{
          opacity: isFilled ? 1 - (i * 0.015) : 0.5,
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-muted-foreground mb-4 font-medium">Daily-Calorie Target</p>
      
      <div className="relative">
        <svg 
          width="200" 
          height="200" 
          viewBox="0 0 200 200"
          className="drop-shadow-sm"
        >
          {segments}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Flame className="w-6 h-6 text-warning mb-1" />
          <p className="text-4xl font-bold text-foreground">{consumed.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">
            of {target.toLocaleString()} Kcal
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalorieProgressRing;
