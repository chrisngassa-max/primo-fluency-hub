import { GraduationCap, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapLogoProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  compact?: boolean;
}

export function CapLogo({ className, markClassName, textClassName, compact }: CapLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <GraduationCap className={cn("h-9 w-9 text-[#0b234a]", markClassName)} strokeWidth={2.2} />
      {!compact && (
        <span className={cn("text-3xl font-black leading-none tracking-tight text-[#0b234a]", textClassName)}>
          CAP <span className="text-[#f47b20]">TCF</span>
        </span>
      )}
    </div>
  );
}

interface CapPublicHeaderProps {
  avatar?: string;
  showMenu?: boolean;
  className?: string;
}

export function CapPublicHeader({ avatar, showMenu = true, className }: CapPublicHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-[74px] items-center justify-between border-b border-black/5 bg-white/92 px-6 shadow-[0_7px_22px_rgba(15,23,42,0.14)] backdrop-blur",
        className
      )}
    >
      <CapLogo />
      {avatar ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7e8ee] text-2xl font-bold text-[#0b234a]">
          {avatar}
        </div>
      ) : showMenu ? (
        <Menu className="h-9 w-9 text-[#0b234a]" />
      ) : null}
    </header>
  );
}

