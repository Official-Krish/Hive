import React from "react";
import { ROOM_PRESETS, type RoomZoneId } from "../interaction/CameraController";
import {
  Sun,
  Moon,
  Sparkles,
  Building2,
  Monitor,
  Users,
  Cpu,
  Server,
  Coffee,
  Compass,
} from "lucide-react";

interface OfficeUIOverlayProps {
  activeZone: RoomZoneId;
  onSelectZone: (zoneId: RoomZoneId) => void;
  lightingMode: "day" | "evening";
  onToggleLighting: () => void;
}

const ZONE_TABS: {
  id: RoomZoneId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "workspace", label: "Workspace", icon: Monitor },
  { id: "conference", label: "Conference", icon: Users },
  { id: "command", label: "AI Core", icon: Cpu },
  { id: "server", label: "Servers", icon: Server },
  { id: "lounge", label: "Lounge", icon: Sparkles },
  { id: "kitchen", label: "Coffee", icon: Coffee },
];

/**
 * Premium Linear / Vercel Aesthetic UI Overlay
 */
export function OfficeUIOverlay({
  activeZone,
  onSelectZone,
  lightingMode,
  onToggleLighting,
}: OfficeUIOverlayProps) {
  const currentPreset = ROOM_PRESETS[activeZone] || ROOM_PRESETS.overview;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-6 font-sans select-none">
      {/* TOP BAR OVERLAY */}
      <div className="flex items-center justify-between gap-4 pointer-events-auto">
        {/* Left Studio Brand & Zone Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono text-slate-400 font-semibold">
                HIVE STUDIO HQ
              </div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{currentPreset.name}</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 px-3.5 py-2.5 rounded-2xl text-xs text-slate-300 items-center gap-2.5 shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-200">
              5 Avatars Online
            </span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-400 font-mono text-[11px]">60 FPS</span>
          </div>
        </div>

        {/* Right Actions & Lighting Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLighting}
            className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 text-slate-200 px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 transition shadow-2xl active:scale-95"
            title="Toggle Day / Evening Lighting"
          >
            {lightingMode === "day" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Day Sunlight</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Evening Studio</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BOTTOM ROOM NAVIGATION BAR */}
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 p-1.5 rounded-2xl shadow-2xl flex items-center gap-1 max-w-full overflow-x-auto">
          {ZONE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeZone === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectZone(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-sky-500/20 border border-sky-500/50 text-white font-semibold shadow-[0_0_12px_rgba(56,189,248,0.2)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-500"}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Minimal Controls Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400 bg-slate-950/60 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800/60">
          <span className="flex items-center gap-1">
            <Compass className="w-3 h-3 text-slate-400" /> Drag to Orbit
          </span>
          <span className="text-slate-700">•</span>
          <span>Scroll to Zoom</span>
          <span className="text-slate-700">•</span>
          <span>Click Zone to Focus</span>
        </div>
      </div>
    </div>
  );
}
