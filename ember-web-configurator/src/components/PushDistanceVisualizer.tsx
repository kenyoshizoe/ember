'use client';

import React, { useState, useEffect, useRef } from 'react';

interface PushDistanceVisualizerProps {
  keyId: number;
  keyLabel: string;
  actuationPoint: number; // Actuation point in mm (0-4)
  currentDistance: number | null; // Current push distance in 0.1mm units (0-40), null if no data
  distanceUpdateTick: number;
}

const PushDistanceVisualizer: React.FC<PushDistanceVisualizerProps> = ({
  keyId,
  keyLabel,
  actuationPoint,
  currentDistance,
  distanceUpdateTick,
}) => {
  const [history, setHistory] = useState<number[]>([]);
  const historyRef = useRef<number[]>([]);
  const maxHistoryLength = 100;
  const SCALE_TO_MM = 0.1;
  const MAX_DISTANCE_MM = 4;

  const actuationPointMm = actuationPoint;
  const currentDistanceMm = currentDistance !== null ? currentDistance * SCALE_TO_MM : null;

  // Update history when currentDistance changes
  useEffect(() => {
    if (currentDistanceMm !== null) {
      const newHistory = [...historyRef.current, currentDistanceMm].slice(-maxHistoryLength);
      historyRef.current = newHistory;
      setHistory(newHistory);
    }
  }, [currentDistanceMm, distanceUpdateTick]);

  // Calculate bar width (0-4mm mapped to 0-100%)
  const getBarWidth = (distance: number | null): number => {
    if (distance === null) return 0;
    return Math.min(Math.max((distance / MAX_DISTANCE_MM) * 100, 0), 100);
  };

  // Calculate actuation point position (0-4mm mapped to 0-100%)
  const actuationPointPosition = Math.min(
    Math.max((actuationPointMm / MAX_DISTANCE_MM) * 100, 0),
    100
  );

  const latestDistanceMm = currentDistanceMm !== null
    ? currentDistanceMm
    : history.length > 0
      ? history[history.length - 1]
      : null;
  const barWidth = getBarWidth(latestDistanceMm);

  // Determine bar color based on actuation
  const getBarColor = (): string => {
    if (latestDistanceMm === null) return 'bg-gray-300';
    if (latestDistanceMm >= actuationPointMm) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-gray-900">Push Distance Monitor</h4>
        </div>
        
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Key:</span>
            <span className="font-medium">{keyLabel} (ID: {keyId})</span>
          </div>
          <div className="flex justify-between">
            <span>Actuation Point:</span>
            <span className="font-medium">{actuationPointMm.toFixed(1)}mm</span>
          </div>
          <div className="flex justify-between">
            <span>Current Distance:</span>
            <span className={`font-medium ${
              latestDistanceMm !== null && latestDistanceMm >= actuationPointMm 
                ? 'text-green-600' 
                : 'text-blue-600'
            }`}>
              {latestDistanceMm !== null ? `${latestDistanceMm.toFixed(1)}mm` : 'No data'}
            </span>
          </div>
        </div>
      </div>

      {/* Distance Bar Visualization */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>0mm</span>
          <span>Push Distance</span>
          <span>4mm</span>
        </div>
        
        {/* Bar container */}
        <div className="relative bg-gray-200 rounded-full h-8 overflow-hidden">
          {/* Actuation point marker */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${actuationPointPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-red-600 font-medium">
              ↓
            </div>
          </div>
          
          {/* Distance bar */}
          <div 
            className={`h-full ${getBarColor()}`}
            style={{ width: `${barWidth}%` }}
          />
          
          {/* Distance text overlay */}
          {latestDistanceMm !== null && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-medium">
              {latestDistanceMm.toFixed(1)}mm
            </div>
          )}
        </div>
        
        {/* Scale markers */}
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
        </div>
      </div>

      {/* Real-time graph */}
      {history.length > 1 && (
        <div className="mt-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Real-time Graph</h5>
          <div className="bg-gray-100 rounded p-2 h-24 relative overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0">
              {/* Actuation line */}
              <line
                x1="0"
                y1={100 - (actuationPointMm / MAX_DISTANCE_MM) * 100}
                x2="100"
                y2={100 - (actuationPointMm / MAX_DISTANCE_MM) * 100}
                stroke="#ef4444"
                strokeWidth="0.5"
                strokeDasharray="1,1"
              />
              
              {/* Distance curve */}
              {history.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  points={history.map((distance, index) => {
                    // Always use full width - spread current data across entire graph
                    const x = (index / (history.length - 1)) * 100;
                    const y = 100 - (distance / MAX_DISTANCE_MM) * 100;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              )}
            </svg>
            
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pointer-events-none">
              <span>4mm</span>
              <span>2mm</span>
              <span>0mm</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushDistanceVisualizer;
