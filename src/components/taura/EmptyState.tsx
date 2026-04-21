import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  secondaryCta?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon: Icon, title, description, ctaLabel, onCta, secondaryCta }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 border border-primary/20">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-[17px] font-bold text-foreground tracking-tight mb-2">{title}</h3>
      <p className="text-[13px] text-muted-foreground max-w-[420px] leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onCta}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          {ctaLabel}
        </button>
        {secondaryCta && (
          <button
            onClick={secondaryCta.onClick}
            className="bg-secondary text-foreground border border-border px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer hover:border-primary/30 transition-colors"
          >
            {secondaryCta.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
