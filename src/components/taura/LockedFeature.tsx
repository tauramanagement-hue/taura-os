import { Lock } from "lucide-react";

interface LockedFeatureProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export const LockedFeature = ({ title, description, icon }: LockedFeatureProps) => {
  return (
    <div className="relative rounded-2xl border border-border/30 bg-secondary/20 p-8 text-center opacity-60">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-card/50 to-transparent pointer-events-none" />
      <div className="relative flex flex-col items-center gap-3">
        <Lock className="w-10 h-10 text-muted-foreground" />
        <div>
          <h3 className="text-[15px] font-semibold text-muted-foreground mb-1">{title}</h3>
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed max-w-xs">{description}</p>
        </div>
        <div className="mt-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          MVP · Disponibile in Pro+
        </div>
      </div>
    </div>
  );
};
