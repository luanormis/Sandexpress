export type DeviceAlertPreferences = {
  vibrationEnabled: boolean;
  volume: number;
};

export const DEFAULT_DEVICE_ALERT_PREFERENCES: DeviceAlertPreferences = {
  vibrationEnabled: true,
  volume: 1,
};

const STORAGE_KEY = "sandexpress_device_alert_preferences_v1";

function clampVolume(value: unknown) {
  const volume = Number(value);
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

export function readDeviceAlertPreferences(): DeviceAlertPreferences {
  if (typeof window === "undefined") return DEFAULT_DEVICE_ALERT_PREFERENCES;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return {
      vibrationEnabled: saved?.vibrationEnabled !== false,
      volume: clampVolume(saved?.volume),
    };
  } catch {
    return DEFAULT_DEVICE_ALERT_PREFERENCES;
  }
}

export function saveDeviceAlertPreferences(preferences: DeviceAlertPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    vibrationEnabled: preferences.vibrationEnabled,
    volume: clampVolume(preferences.volume),
  }));
}

export function vibrateDevice(preferences: DeviceAlertPreferences) {
  if (!preferences.vibrationEnabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate([220, 90, 220]);
}
