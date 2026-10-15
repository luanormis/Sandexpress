"use client";
import { useEffect } from 'react';
export function PlatformThemeRuntime() {
  useEffect(() => { fetch('/api/platform-settings/theme', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(theme => { if (!theme) return; const root = document.documentElement; root.style.setProperty('--platform-background', theme.background); root.style.setProperty('--platform-foreground', theme.foreground); root.style.setProperty('--platform-surface', theme.surface); root.style.setProperty('--platform-primary', theme.primary); root.style.setProperty('--platform-border', theme.border); root.style.setProperty('--platform-muted', theme.muted); root.style.setProperty('--platform-button-text', theme.buttonText); }).catch(() => undefined); }, []);
  return null;
}
