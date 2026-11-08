import { Home, Stamp, ShieldCheck, Wallet, ScanFace, LayoutGrid, type LucideIcon } from 'lucide-react';

/** Icons available to registry entries, by name. */
export const APP_ICONS: Record<string, LucideIcon> = {
  home: Home,
  stamp: Stamp,
  shield: ShieldCheck,
  wallet: Wallet,
  identity: ScanFace,
};

export function appIcon(name: string): LucideIcon {
  return APP_ICONS[name] ?? LayoutGrid;
}
