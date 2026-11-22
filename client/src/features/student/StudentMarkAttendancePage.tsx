import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Radio,
  CheckCircle2,
  XCircle,
  Smartphone,
  ShieldCheck,
  RotateCcw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const StudentMarkAttendancePage: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<'SUCCESS' | 'REJECTED' | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [simulatedDistance, setSimulatedDistance] = useState<number>(68); // Demo Mode simulation slider (default 68m within 500m geofence)

  const handleMarkAttendance = () => {
    setIsScanning(true);
    setResult(null);

    // Simulate location capture & server verification
    setTimeout(() => {
      setIsScanning(false);
      setDistance(simulatedDistance);

      if (simulatedDistance <= 500) {
        setResult('SUCCESS');
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.65 },
        });
      } else {
        setResult('REJECTED');
      }
    }, 1800);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Session Details Card */}
      <Card className="text-center p-8 relative overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-center gap-2 mb-3">
          <Badge variant="brand">GEOFENCE ACTIVE</Badge>
          <span className="text-xs text-content-secondary font-mono">Radius: 500m</span>
        </div>

        <h1 className="text-2xl font-heading font-extrabold text-content">
          Data Structures & Algorithms
        </h1>
        <p className="text-xs text-content-secondary mt-1">
          Dr. Ramesh Kumar • Lab 302 • CSE – Year 2 – Section A
        </p>

        {/* Big Radar Scanning Button */}
        <div className="my-8 flex flex-col items-center justify-center">
          <div className="relative">
            {/* Animated Radar Ripples */}
            {isScanning && (
              <>
                <div className="absolute inset-0 rounded-full bg-brand-500 animate-radar-pulse opacity-75" />
                <div className="absolute -inset-4 rounded-full border-2 border-brand-500/50 animate-ping opacity-40" />
              </>
            )}

            <button
              onClick={handleMarkAttendance}
              disabled={isScanning}
              className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center text-white transition-all duration-300 shadow-2xl active:scale-95 ${
                result === 'SUCCESS'
                  ? 'bg-emerald-500 shadow-emerald-500/30'
                  : result === 'REJECTED'
                  ? 'bg-rose-500 shadow-rose-500/30'
                  : 'bg-brand-gradient hover:scale-105 shadow-brand-500/40'
              }`}
            >
              {isScanning ? (
                <>
                  <Radio className="w-10 h-10 animate-spin mb-1 text-white" />
                  <span className="text-xs font-bold uppercase tracking-wider">Acquiring GPS</span>
                  <span className="text-[10px] text-white/80">Checking Geofence...</span>
                </>
              ) : result === 'SUCCESS' ? (
                <>
                  <CheckCircle2 className="w-12 h-12 mb-1" />
                  <span className="text-sm font-bold uppercase tracking-wider">Verified!</span>
                  <span className="text-xs font-mono font-semibold">{distance}m away</span>
                </>
              ) : result === 'REJECTED' ? (
                <>
                  <XCircle className="w-12 h-12 mb-1" />
                  <span className="text-sm font-bold uppercase tracking-wider">Out of Range</span>
                  <span className="text-xs font-mono font-semibold">{distance}m away</span>
                </>
              ) : (
                <>
                  <MapPin className="w-10 h-10 mb-2" />
                  <span className="text-sm font-extrabold uppercase tracking-wide">
                    Mark My
                  </span>
                  <span className="text-base font-black">ATTENDANCE</span>
                </>
              )}
            </button>
          </div>

          <p className="mt-4 text-xs text-content-secondary">
            {isScanning
              ? 'Connecting to GPS satellites & verifying hardware signature...'
              : 'Tap to fix coordinates and verify within 500m classroom geofence'}
          </p>
        </div>

        {/* Verification Result Feedback */}
        {result === 'SUCCESS' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left animate-fade-in">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">Attendance Successfully Recorded!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You are <strong className="font-mono">{distance} meters</strong> from the faculty anchor. Verification method: <span className="font-bold">GPS Geofence</span>.
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Bound Device: Verified (dev_iphone_15_arun)
                </div>
              </div>
            </div>
          </div>
        )}

        {result === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-accent-rose shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900">Geofence Boundary Exceeded</h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  You are currently <strong className="font-mono">{distance} meters</strong> away from Lab 302. You must be within the 500-meter radius to mark attendance.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setResult(null)}
                  className="mt-3 text-xs"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retry Scan
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* DEMO MODE SIMULATION CONTROLLER (Required by Prompt Section 13) */}
      <Card className="p-5 border border-brand-200 bg-surface-soft/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-content">
              Demo Mode GPS Position Simulator
            </h4>
          </div>
          <Badge variant="brand" size="sm">Laptop Testing Mode</Badge>
        </div>

        <p className="text-xs text-content-secondary mb-3">
          Simulate student distance from faculty anchor to test both inside-radius and out-of-boundary scenarios:
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className={simulatedDistance <= 500 ? 'text-accent-emerald' : 'text-accent-rose'}>
              Simulated Distance: {simulatedDistance}m {simulatedDistance <= 500 ? '(Inside 500m)' : '(Outside Geofence)'}
            </span>
          </div>

          <input
            type="range"
            min="20"
            max="1200"
            step="20"
            value={simulatedDistance}
            onChange={(e) => {
              setSimulatedDistance(Number(e.target.value));
              setResult(null);
            }}
            className="w-full accent-brand-500"
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSimulatedDistance(65);
                setResult(null);
              }}
              className="text-[11px] font-bold px-3 py-1 rounded-xl bg-white border border-border hover:border-emerald-400 text-emerald-700"
            >
              Preset: In Classroom (65m)
            </button>
            <button
              onClick={() => {
                setSimulatedDistance(240);
                setResult(null);
              }}
              className="text-[11px] font-bold px-3 py-1 rounded-xl bg-white border border-border hover:border-emerald-400 text-emerald-700"
            >
              Preset: Campus Canteen (240m)
            </button>
            <button
              onClick={() => {
                setSimulatedDistance(820);
                setResult(null);
              }}
              className="text-[11px] font-bold px-3 py-1 rounded-xl bg-white border border-border hover:border-rose-400 text-rose-700"
            >
              Preset: Hostel / Outside (820m)
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
