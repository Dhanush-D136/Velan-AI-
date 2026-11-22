import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import {
  Smartphone,
  ShieldCheck,
  Bell,
  Sliders,
  Moon,
  Building,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, deviceId } = useAuthStore();
  const [webPushEnabled, setWebPushEnabled] = useState(true);
  const [gpsHighAccuracy, setGpsHighAccuracy] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          System & Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-content-secondary mt-1">
          Device lock bindings, campus geofence configurations, and notification preferences.
        </p>
      </div>

      {/* Hardware Device Lock Binding Details */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-accent-emerald">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-content">
                Authorized Hardware Device
              </h3>
              <p className="text-xs text-content-secondary">
                This account is bound to your specific hardware identifier for GPS attendance security.
              </p>
            </div>
          </div>
          <Badge variant="success">Device Verified</Badge>
        </div>

        <div className="p-4 rounded-2xl bg-surface-soft border border-border text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-content-secondary">Hardware Fingerprint ID:</span>
            <span className="font-mono font-bold text-content">{deviceId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-secondary">Platform / OS:</span>
            <span className="font-medium text-content">{navigator.platform || 'Desktop Browser'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-secondary">Security Status:</span>
            <span className="font-semibold text-accent-emerald">Bound & Active</span>
          </div>
        </div>
      </Card>

      {/* Notification & Push Configuration */}
      <Card>
        <h3 className="font-heading font-bold text-base text-content mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand-600" />
          Notification Channels
        </h3>

        <div className="space-y-4 divide-y divide-border">
          <div className="pt-2 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Web Push Notifications (VAPID)</h4>
              <p className="text-xs text-content-secondary">
                Receive instant alerts when attendance opens or assignments are due.
              </p>
            </div>
            <Switch checked={webPushEnabled} onChange={setWebPushEnabled} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">High Accuracy Geolocation Mode</h4>
              <p className="text-xs text-content-secondary">
                Forces GPS sensor hardware polling to maintain &lt; 30m accuracy threshold.
              </p>
            </div>
            <Switch checked={gpsHighAccuracy} onChange={setGpsHighAccuracy} />
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-content">Quiet Hours (10:00 PM – 06:00 AM)</h4>
              <p className="text-xs text-content-secondary">
                Mute non-urgent class chat alerts during off-campus hours.
              </p>
            </div>
            <Switch checked={quietHours} onChange={setQuietHours} />
          </div>
        </div>
      </Card>
    </div>
  );
};
