import { Link } from "react-router-dom";

interface PrivacyCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  variant?: "default" | "compact";
  showMarketing?: boolean;
  marketingChecked?: boolean;
  onMarketingChange?: (checked: boolean) => void;
  error?: string;
}

const PrivacyCheckbox = ({
  id = "privacy-consent",
  checked,
  onChange,
  required = true,
  variant = "default",
  showMarketing = false,
  marketingChecked = false,
  onMarketingChange,
  error,
}: PrivacyCheckboxProps) => {
  const sz = variant === "compact" ? "text-[11px]" : "text-[12px]";
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={`flex items-start gap-2 ${sz} text-muted-foreground cursor-pointer`}>
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
        <span>
          Ho letto e accetto la{" "}
          <Link to="/privacy" target="_blank" className="text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          e i{" "}
          <Link to="/terms" target="_blank" className="text-primary hover:underline">
            Termini di Servizio
          </Link>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>

      {showMarketing && onMarketingChange && (
        <label htmlFor={`${id}-marketing`} className={`flex items-start gap-2 ${sz} text-muted-foreground cursor-pointer`}>
          <input
            id={`${id}-marketing`}
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
            checked={marketingChecked}
            onChange={(e) => onMarketingChange(e.target.checked)}
          />
          <span>
            Acconsento a ricevere comunicazioni di marketing (facoltativo, revocabile in qualsiasi momento).
          </span>
        </label>
      )}

      {error && (
        <div id={`${id}-error`} role="alert" className="text-[11px] text-red-500 ml-6">
          {error}
        </div>
      )}
    </div>
  );
};

export default PrivacyCheckbox;
