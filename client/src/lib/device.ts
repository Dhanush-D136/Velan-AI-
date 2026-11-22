/**
 * Velan AI - Native / Web Device Identifier Resolver
 * Ensures 1-phone 1-account hardware lock security.
 * Uses Capacitor Plugin Bridge on native mobile, falling back to persistent localStorage in web browsers.
 */

export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem('velan_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem('velan_device_id', id);
  }
  return id;
};

export const syncNativeDeviceId = async (): Promise<string> => {
  const current = getOrCreateDeviceId();
  try {
    const Cap = (window as any).Capacitor;
    if (Cap?.isNativePlatform?.() && Cap?.Plugins?.Device) {
      const info = await Cap.Plugins.Device.getId();
      if (info?.identifier) {
        const nativeId = `cap_${info.identifier}`;
        localStorage.setItem('velan_device_id', nativeId);
        return nativeId;
      }
    }
  } catch (err) {
    console.debug('Native Device plugin not accessible, using fallback ID');
  }
  return current;
};
