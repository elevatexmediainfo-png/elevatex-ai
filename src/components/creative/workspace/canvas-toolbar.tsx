"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, RotateCcw, Shuffle, Wand2, Edit2, Share2, Maximize2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  resultUrl: string;
  onVariation: () => void;
  onRegenerate: () => void;
  onEditPrompt: () => void;
  isBusy: boolean;
}

export function CanvasToolbar({
  resultUrl,
  onVariation,
  onRegenerate,
  onEditPrompt,
  isBusy,
}: CanvasToolbarProps) {
  const handleDownload = React.useCallback(() => {
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `elevatex-${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resultUrl]);

  const comingSoon = (label: string) => toast.info(`${label} — coming soon!`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <Btn onClick={handleDownload} icon={<Download className="size-4" />} label="Download" primary />
      <Btn onClick={onVariation} icon={<Shuffle className="size-4" />} label="Variation" disabled={isBusy} />
      <Btn onClick={onRegenerate} icon={<RotateCcw className="size-4" />} label="Again" disabled={isBusy} />
      <Btn onClick={onEditPrompt} icon={<Pencil className="size-4" />} label="Edit Prompt" disabled={isBusy} />
      <Btn onClick={() => comingSoon("Upscale")} icon={<Wand2 className="size-4" />} label="Upscale" />
      <Btn onClick={() => comingSoon("Edit")} icon={<Edit2 className="size-4" />} label="Edit" />
      <Btn onClick={() => comingSoon("Share")} icon={<Share2 className="size-4" />} label="Share" />
      <Btn onClick={() => comingSoon("Fullscreen")} icon={<Maximize2 className="size-4" />} label="Fullscreen" />
    </motion.div>
  );
}

interface BtnProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}

function Btn({ onClick, icon, label, primary, disabled }: BtnProps) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? {} : { y: -2, scale: 1.04 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]",
        "disabled:pointer-events-none disabled:opacity-40",
        primary
          ? "text-white shadow-[0_4px_20px_rgba(124,58,237,0.30),0_2px_8px_rgba(37,99,235,0.15)]"
          : "border border-white/[0.09] bg-white/[0.04] text-white/65 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white",
      )}
      style={primary ? { background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" } : undefined}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
