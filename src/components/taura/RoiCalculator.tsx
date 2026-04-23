import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Coins, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1] as const;

const HOURLY_COST = 45;
const CONFLICT_RATE = 0.02;
const AVG_PENALTY = 15000;

const fmtNumber = (n: number) => new Intl.NumberFormat("it-IT").format(Math.round(n));
const fmtEur = (n: number) =>
  "€" + new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(Math.round(n));

export default function RoiCalculator() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState(20);
  const [contractsPerMonth, setContractsPerMonth] = useState(5);

  const { hoursSavedMonth, eurSavedYear, penaltiesAvoidedYear, totalYear } = useMemo(() => {
    const hoursSavedMonth = athletes * 0.33 + contractsPerMonth * 1.3;
    const eurSavedYear = hoursSavedMonth * 12 * HOURLY_COST;
    const penaltiesAvoidedYear = contractsPerMonth * 12 * CONFLICT_RATE * AVG_PENALTY;
    const totalYear = eurSavedYear + penaltiesAvoidedYear;
    return { hoursSavedMonth, eurSavedYear, penaltiesAvoidedYear, totalYear };
  }, [athletes, contractsPerMonth]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mt-12 bg-card/70 backdrop-blur-xl rounded-2xl border border-border/50 p-7 md:p-10"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }}
        />
        <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
          Calcolatore ROI
        </span>
      </div>
      <h3 className="text-[22px] md:text-[26px] font-bold tracking-tight mb-6">
        Calcola il risparmio con la tua realtà.
      </h3>

      <div className="grid md:grid-cols-[1fr_1fr] gap-8 items-center">
        {/* INPUTS */}
        <div className="space-y-6">
          <Slider
            label="Quanti atleti gestisci?"
            value={athletes}
            min={5}
            max={200}
            step={5}
            suffix="atleti"
            onChange={setAthletes}
          />
          <Slider
            label="Quanti contratti nuovi al mese?"
            value={contractsPerMonth}
            min={1}
            max={50}
            step={1}
            suffix="contratti/mese"
            onChange={setContractsPerMonth}
          />

          <div className="pt-2 text-[11px] text-muted-foreground leading-relaxed">
            Assunzioni: costo orario junior PM €{HOURLY_COST}, tasso medio conflitti contrattuali {(CONFLICT_RATE * 100).toFixed(0)}%, penale media {fmtEur(AVG_PENALTY)} per conflitto non rilevato.
          </div>
        </div>

        {/* OUTPUTS */}
        <div className="bg-background/60 rounded-2xl border border-border/50 p-6">
          <div className="space-y-4">
            <OutputRow
              Icon={Clock}
              label="Ore risparmiate / mese"
              value={`${fmtNumber(hoursSavedMonth)}h`}
              tint="text-taura-blue"
            />
            <OutputRow
              Icon={Coins}
              label="€ risparmiati / anno"
              value={fmtEur(eurSavedYear)}
              tint="text-taura-green"
            />
            <OutputRow
              Icon={ShieldAlert}
              label="Penali potenziali evitate / anno"
              value={fmtEur(penaltiesAvoidedYear)}
              tint="text-taura-orange"
            />
          </div>

          <div className="mt-5 pt-5 border-t border-border/40">
            <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1">
              Risparmio stimato totale
            </div>
            <div className="text-[32px] md:text-[40px] font-bold tracking-tight text-primary leading-none tabular-nums">
              {fmtEur(totalYear)}
              <span className="text-[16px] text-muted-foreground font-semibold"> / anno</span>
            </div>
          </div>

          <button
            onClick={() => navigate("/pricing")}
            className="group mt-5 w-full bg-primary text-primary-foreground rounded-xl py-3 text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            Richiedi accesso e attiva il calcolo sui tuoi dati
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[13px] font-semibold text-foreground">{label}</label>
        <span className="text-[13px] font-mono font-bold text-primary tabular-nums">
          {value} <span className="text-[10px] text-muted-foreground font-sans font-medium">{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer roi-slider"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${pct}%, hsl(var(--secondary)) ${pct}%, hsl(var(--secondary)) 100%)`,
        }}
      />
      <style>{`
        .roi-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          border: 3px solid hsl(var(--background));
          box-shadow: 0 2px 8px hsl(var(--primary) / 0.4);
          cursor: grab;
        }
        .roi-slider::-webkit-slider-thumb:active { cursor: grabbing; }
        .roi-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          border: 3px solid hsl(var(--background));
          box-shadow: 0 2px 8px hsl(var(--primary) / 0.4);
          cursor: grab;
        }
      `}</style>
    </div>
  );
}

function OutputRow({
  Icon,
  label,
  value,
  tint,
}: {
  Icon: typeof Clock;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 ${tint}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
        <motion.span
          key={value}
          initial={{ opacity: 0.4, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[17px] font-bold text-foreground tabular-nums"
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}
