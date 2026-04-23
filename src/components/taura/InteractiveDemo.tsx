import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Users,
  Search,
  Bell,
  AlertTriangle,
  TrendingUp,
  Calendar as CalendarIcon,
  Megaphone,
  CheckCircle2,
  Plus,
  Instagram,
  Youtube,
  Music2,
  Eye,
  ChevronDown,
  ChevronRight,
  Copy,
  Mail,
  Upload,
  FileText,
} from "lucide-react";
import { MiniChart } from "@/components/taura/ui-primitives";
import DemoChatPanel from "@/components/taura/DemoChatPanel";

const EASE = [0.22, 1, 0.36, 1] as const;

type Tab = "dashboard" | "campagne" | "roster" | "calendario";

const athletes = [
  { init: "MR", name: "Marco Rossi", team: "Serie A · Lazio", rev: "€245k", status: "active", color: "hsl(220, 90%, 62%)", reach: "1.2M", contracts: 3 },
  { init: "LF", name: "Luca Ferrari", team: "ATP · #84", rev: "€180k", status: "renewal", color: "hsl(258, 82%, 65%)", reach: "420k", contracts: 2 },
  { init: "SB", name: "Sara Bianchi", team: "Creator · Fitness", rev: "€92k", status: "active", color: "hsl(335, 80%, 62%)", reach: "890k", contracts: 4 },
  { init: "AC", name: "Andrea Conti", team: "Serie B · Bari", rev: "€67k", status: "active", color: "hsl(25, 90%, 58%)", reach: "310k", contracts: 2 },
  { init: "GM", name: "Giulia Marino", team: "Beach Volley · Naz.", rev: "€54k", status: "conflict", color: "hsl(160, 67%, 52%)", reach: "520k", contracts: 2 },
];

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Attivo", cls: "bg-taura-green/15 text-taura-green border-taura-green/30" },
  renewal: { label: "Rinnovo", cls: "bg-taura-orange/15 text-taura-orange border-taura-orange/30" },
  conflict: { label: "Conflitto", cls: "bg-taura-red/15 text-taura-red border-taura-red/30" },
};

type DeliverableStatus = "draft" | "to_approve" | "to_post" | "posted";
type Platform = "instagram" | "tiktok" | "youtube";
type DeliverableType = "reel" | "post" | "story" | "short";

type Deliverable = {
  id: string;
  title: string;
  brief: string;
  talent: { init: string; name: string; color: string };
  platform: Platform;
  type: DeliverableType;
  scheduledDate: string;
  status: DeliverableStatus;
  metrics?: { reach: string; eng: string };
};

type Campaign = {
  id: string;
  brand: string;
  title: string;
  budget: string;
  startDate: string;
  endDate: string;
  talents: { init: string; color: string }[];
  status: "active" | "review" | "planning";
  deliverables: Deliverable[];
};

const campaigns: Campaign[] = [
  {
    id: "c1",
    brand: "Nike",
    title: "Air Max 2026 · Summer Drop",
    budget: "€85.000",
    startDate: "1 apr 2026",
    endDate: "31 mag 2026",
    talents: [
      { init: "MR", color: "hsl(220, 90%, 62%)" },
      { init: "SB", color: "hsl(335, 80%, 62%)" },
    ],
    status: "active",
    deliverables: [
      {
        id: "d1",
        title: "Unboxing Air Max Summer",
        brief: "Reel 30s unboxing con claim 'Run the Summer'. Logo visibile nei primi 3s.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "2 mag",
        status: "posted",
        metrics: { reach: "412k", eng: "6.2%" },
      },
      {
        id: "d2",
        title: "Air Max Workout Routine",
        brief: "Post carousel 5 slide con workout routine indossando le Air Max.",
        talent: { init: "SB", name: "Sara Bianchi", color: "hsl(335, 80%, 62%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "6 mag",
        status: "posted",
        metrics: { reach: "184k", eng: "8.1%" },
      },
      {
        id: "d3",
        title: "Matchday Air Max",
        brief: "Story 3 frames da pre-partita. Close-up scarpe al minuto 00:08.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "11 mag",
        status: "posted",
        metrics: { reach: "298k", eng: "4.7%" },
      },
      {
        id: "d4",
        title: "Air Max Summer Challenge",
        brief: "Reel TikTok 15s con transition + trending audio. Hashtag #RunTheSummer.",
        talent: { init: "SB", name: "Sara Bianchi", color: "hsl(335, 80%, 62%)" },
        platform: "tiktok",
        type: "reel",
        scheduledDate: "14 mag",
        status: "posted",
        metrics: { reach: "620k", eng: "9.4%" },
      },
      {
        id: "d5",
        title: "Behind the Scenes · Training",
        brief: "Post IG con 4 foto dal training. Taglia Nike in bio e swipe-up menzione.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "18 mag",
        status: "to_approve",
      },
      {
        id: "d6",
        title: "Air Max Summer Drop",
        brief: "Reel lancio ufficiale 20s, voice-over e call-to-action sul sito.",
        talent: { init: "SB", name: "Sara Bianchi", color: "hsl(335, 80%, 62%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "22 mag",
        status: "to_approve",
      },
      {
        id: "d7",
        title: "Drop Day · Live Story",
        brief: "Story live dal drop del 25 mag. 4-6 frame, prodotti taggati.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "25 mag",
        status: "to_post",
      },
      {
        id: "d8",
        title: "Air Max Review Short",
        brief: "YouTube Short 45s con review tecnica. Link negli Shorts.",
        talent: { init: "SB", name: "Sara Bianchi", color: "hsl(335, 80%, 62%)" },
        platform: "youtube",
        type: "short",
        scheduledDate: "28 mag",
        status: "draft",
      },
    ],
  },
  {
    id: "c2",
    brand: "Adidas",
    title: "Serie A Boost Campaign",
    budget: "€120.000",
    startDate: "15 mar 2026",
    endDate: "22 mag 2026",
    talents: [
      { init: "MR", color: "hsl(220, 90%, 62%)" },
      { init: "AC", color: "hsl(25, 90%, 58%)" },
    ],
    status: "active",
    deliverables: [
      {
        id: "a1",
        title: "Season Kickoff",
        brief: "Post IG con divisa nuova + claim 'Impossible is Nothing'.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "20 mar",
        status: "posted",
        metrics: { reach: "520k", eng: "5.8%" },
      },
      {
        id: "a2",
        title: "Match Highlights Reel",
        brief: "Reel 20s highlight partita con scarpe Adidas visibili.",
        talent: { init: "AC", name: "Andrea Conti", color: "hsl(25, 90%, 58%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "28 mar",
        status: "posted",
        metrics: { reach: "145k", eng: "7.2%" },
      },
      {
        id: "a3",
        title: "Training Day Story",
        brief: "Story 4 frame dalla seduta di allenamento.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "5 apr",
        status: "posted",
        metrics: { reach: "320k", eng: "3.9%" },
      },
      {
        id: "a4",
        title: "Boost Collection Feature",
        brief: "Reel 30s showcase collezione. Taglio cinematic.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "12 apr",
        status: "posted",
        metrics: { reach: "480k", eng: "6.5%" },
      },
      {
        id: "a5",
        title: "Man of the Match Post",
        brief: "Post IG MOTM con scarpe Adidas in primo piano.",
        talent: { init: "AC", name: "Andrea Conti", color: "hsl(25, 90%, 58%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "18 apr",
        status: "posted",
        metrics: { reach: "98k", eng: "8.4%" },
      },
      {
        id: "a6",
        title: "Serie A Top Moments",
        brief: "TikTok 25s best moments stagione.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "tiktok",
        type: "reel",
        scheduledDate: "25 apr",
        status: "posted",
        metrics: { reach: "890k", eng: "11.2%" },
      },
      {
        id: "a7",
        title: "Derby Day Story",
        brief: "Story 5 frame pre-match + close-up scarpe.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "2 mag",
        status: "posted",
        metrics: { reach: "410k", eng: "5.1%" },
      },
      {
        id: "a8",
        title: "Season Wrap Reel",
        brief: "Reel retrospettiva stagione 45s. Musica licensed.",
        talent: { init: "AC", name: "Andrea Conti", color: "hsl(25, 90%, 58%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "15 mag",
        status: "to_approve",
      },
      {
        id: "a9",
        title: "Closing Post Serie A",
        brief: "Post fine stagione, carosello 6 foto.",
        talent: { init: "MR", name: "Marco Rossi", color: "hsl(220, 90%, 62%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "19 mag",
        status: "to_post",
      },
      {
        id: "a10",
        title: "Thank You Fans Story",
        brief: "Story 3 frame ringraziamento tifosi.",
        talent: { init: "AC", name: "Andrea Conti", color: "hsl(25, 90%, 58%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "22 mag",
        status: "draft",
      },
    ],
  },
  {
    id: "c3",
    brand: "Garmin",
    title: "Triathlon Pro Ambassadors",
    budget: "€40.000",
    startDate: "1 apr 2026",
    endDate: "30 mag 2026",
    talents: [{ init: "LF", color: "hsl(258, 82%, 65%)" }],
    status: "review",
    deliverables: [
      {
        id: "g1",
        title: "Garmin Forerunner Review",
        brief: "Post review dispositivo + 3 feature chiave.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "8 apr",
        status: "posted",
        metrics: { reach: "62k", eng: "9.1%" },
      },
      {
        id: "g2",
        title: "Training Week Story",
        brief: "Story con dati Garmin in overlay durante allenamento.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "16 apr",
        status: "posted",
        metrics: { reach: "48k", eng: "6.8%" },
      },
      {
        id: "g3",
        title: "Race Day Content",
        brief: "Reel 20s giorno gara con tracking Garmin visibile.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "12 mag",
        status: "to_approve",
      },
      {
        id: "g4",
        title: "YouTube Short Performance",
        brief: "YouTube Short 60s deep dive feature avanzate.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "youtube",
        type: "short",
        scheduledDate: "20 mag",
        status: "to_approve",
      },
      {
        id: "g5",
        title: "Post-Race Reflection",
        brief: "Post con recap gara + metriche Garmin.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "25 mag",
        status: "to_post",
      },
      {
        id: "g6",
        title: "Season Recap",
        brief: "Reel fine stagione 30s con best moments.",
        talent: { init: "LF", name: "Luca Ferrari", color: "hsl(258, 82%, 65%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "30 mag",
        status: "draft",
      },
    ],
  },
  {
    id: "c4",
    brand: "Red Bull",
    title: "Beach Volley Summer Tour",
    budget: "€62.000",
    startDate: "20 mag 2026",
    endDate: "12 giu 2026",
    talents: [{ init: "GM", color: "hsl(160, 67%, 52%)" }],
    status: "planning",
    deliverables: [
      {
        id: "r1",
        title: "Tour Announce Reel",
        brief: "Reel annuncio tour con lattina Red Bull visibile.",
        talent: { init: "GM", name: "Giulia Marino", color: "hsl(160, 67%, 52%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "24 mag",
        status: "draft",
      },
      {
        id: "r2",
        title: "Beach Training Session",
        brief: "Post carousel 5 foto training in spiaggia.",
        talent: { init: "GM", name: "Giulia Marino", color: "hsl(160, 67%, 52%)" },
        platform: "instagram",
        type: "post",
        scheduledDate: "30 mag",
        status: "draft",
      },
      {
        id: "r3",
        title: "Tournament Story Series",
        brief: "Story live 8 frame dal torneo.",
        talent: { init: "GM", name: "Giulia Marino", color: "hsl(160, 67%, 52%)" },
        platform: "instagram",
        type: "story",
        scheduledDate: "7 giu",
        status: "draft",
      },
      {
        id: "r4",
        title: "Final Match Highlights",
        brief: "Reel 25s highlight finale torneo.",
        talent: { init: "GM", name: "Giulia Marino", color: "hsl(160, 67%, 52%)" },
        platform: "instagram",
        type: "reel",
        scheduledDate: "12 giu",
        status: "draft",
      },
    ],
  },
];

const campaignStatusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Attiva", cls: "bg-taura-green/15 text-taura-green border-taura-green/30" },
  review: { label: "In review", cls: "bg-taura-orange/15 text-taura-orange border-taura-orange/30" },
  planning: { label: "Planning", cls: "bg-primary/15 text-primary border-primary/30" },
};

const platformIcon: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
};

type CalEvent = { day: number; type: "deliverable" | "renewal" | "meeting" | "conflict"; label: string };

const calendarEvents: CalEvent[] = [
  { day: 3, type: "deliverable", label: "Reel Nike · M. Rossi" },
  { day: 5, type: "renewal", label: "Rinnovo Puma · L. Ferrari" },
  { day: 8, type: "meeting", label: "Call Adidas · Briefing" },
  { day: 11, type: "deliverable", label: "Post IG · S. Bianchi" },
  { day: 14, type: "conflict", label: "Risolvere conflitto Adidas" },
  { day: 17, type: "deliverable", label: "Story Garmin · L. Ferrari" },
  { day: 21, type: "meeting", label: "Review campagna Nike" },
  { day: 24, type: "deliverable", label: "Reel Red Bull · G. Marino" },
  { day: 28, type: "renewal", label: "Rinnovo Nike · M. Rossi" },
];

const eventTint: Record<string, string> = {
  deliverable: "bg-primary/20 text-primary border-primary/40",
  renewal: "bg-taura-orange/20 text-taura-orange border-taura-orange/40",
  meeting: "bg-taura-blue/20 text-taura-blue border-taura-blue/40",
  conflict: "bg-taura-red/20 text-taura-red border-taura-red/40",
};

const SIDEBAR_ITEMS: { id: Tab; Icon: typeof BarChart3; label: string }[] = [
  { id: "dashboard", Icon: BarChart3, label: "Dashboard" },
  { id: "campagne", Icon: Megaphone, label: "Campagne" },
  { id: "roster", Icon: Users, label: "Roster" },
  { id: "calendario", Icon: CalendarIcon, label: "Calendario" },
];

export default function InteractiveDemo() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="relative">
      <div
        className="absolute inset-0 -bottom-16 blur-3xl opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.18) 0%, transparent 65%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-secondary/50">
          <div className="w-2.5 h-2.5 rounded-full bg-taura-red/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-taura-orange/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-taura-green/50" />
          <span className="ml-3 inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            Demo
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">demo.taura.app/{tab}</span>
        </div>

        <div className="grid grid-cols-[56px_1fr] md:grid-cols-[72px_1fr]">
          <aside className="relative border-r border-border/40 bg-secondary/30 flex flex-col items-center py-4 gap-1.5">
            {/* Active indicator — lifted out of buttons for stable positioning.
                py-4=16px · button h-11=44px · gap-1.5=6px · indicator h-5=20px
                => indicator.top = 16 + idx*(44+6) + (44-20)/2 = 28 + idx*50 */}
            <motion.span
              aria-hidden
              className="absolute left-0 w-[3px] h-5 rounded-r-full bg-primary pointer-events-none"
              animate={{ top: 28 + SIDEBAR_ITEMS.findIndex((it) => it.id === tab) * 50 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.6)" }}
            />
            {SIDEBAR_ITEMS.map((it) => {
              const active = tab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => setTab(it.id)}
                  title={it.label}
                  className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  <it.Icon className="w-4 h-4" />
                </button>
              );
            })}
          </aside>

          <main className="min-w-0 min-h-[560px] md:min-h-[640px]">
            <AnimatePresence mode="wait">
              {tab === "dashboard" && <DashboardView key="dashboard" />}
              {tab === "campagne" && <CampagneView key="campagne" />}
              {tab === "roster" && <RosterView key="roster" />}
              {tab === "calendario" && <CalendarioView key="calendario" />}
            </AnimatePresence>
          </main>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[12px] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Demo interattiva - versione ridotta, dati di esempio. Chiedi a Taura AI dal pannello destro: ogni azione del sistema si fa anche via prompt.
        </span>
      </motion.div>
    </div>
  );
}

// ─── VIEW: Dashboard ──────────────────────────────────────────────────────
function DashboardView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="grid md:grid-cols-[1fr_340px]"
    >
      <div className="min-w-0 p-5 md:p-6 border-r border-border/40">
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
              Command Center
            </div>
            <h3 className="text-[17px] font-bold tracking-tight truncate">Panoramica - Aprile 2026</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-secondary/60 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <Search className="w-3 h-3" />
              <span>Cerca talent, contratto...</span>
            </div>
            <div className="relative">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-taura-red" />
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-taura-blue" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { l: "REVENUE YTD", v: "€892k", d: [30, 45, 52, 48, 62, 72, 78, 85, 92], c: "hsl(160, 67%, 52%)", up: "+18%" },
            { l: "CONTRATTI", v: "47", d: [22, 28, 32, 38, 42, 45, 47, 47, 47], c: "hsl(220, 90%, 62%)", up: "+6" },
            { l: "DELIVERABLE", v: "23", d: [12, 18, 20, 22, 19, 25, 23, 22, 23], c: "hsl(258, 82%, 65%)", up: "-3" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="bg-secondary/50 rounded-xl p-3 border border-border/40"
            >
              <div className="flex items-baseline justify-between">
                <div className="text-[9px] font-bold text-muted-foreground tracking-wider">{s.l}</div>
                <div className="text-[9px] font-semibold text-taura-green">{s.up}</div>
              </div>
              <div className="text-[19px] font-bold mt-0.5" style={{ color: s.c }}>{s.v}</div>
              <MiniChart data={s.d} color={s.c} h={22} />
            </motion.div>
          ))}
        </div>

        {/* Inline AI alerts */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary"
              style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.8)" }}
            />
            <span className="text-[10px] font-bold text-primary tracking-wider">ALERT AI - OGGI</span>
          </div>
          <div className="grid md:grid-cols-3 gap-2.5">
            <AlertCard
              tone="red"
              Icon={AlertTriangle}
              tag="CONFLITTO"
              body={<>Deal Puma per <strong>G. Marino</strong> confligge con clausola 3.1 Adidas.</>}
              footer="Rischio €15k"
            />
            <AlertCard
              tone="orange"
              Icon={Bell}
              tag="SCADENZA 14gg"
              body={<>Contratto <strong>L. Ferrari</strong> / Puma scade il 5 mag.</>}
            />
            <AlertCard
              tone="primary"
              Icon={TrendingUp}
              tag="OPPORTUNITÀ"
              body={<>Reach <strong>S. Bianchi</strong> +32%. Pitch a Nike?</>}
            />
          </div>
        </div>

        <div className="bg-secondary/40 rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground">Top atleti per revenue</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Vedi tutti ({athletes.length})</span>
          </div>
          <div className="divide-y divide-border/30">
            {athletes.map((a, i) => {
              const s = statusLabel[a.status];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: a.color }}
                  >
                    {a.init}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{a.team}</div>
                  </div>
                  <div className="hidden md:block text-[12px] font-mono font-semibold text-foreground tabular-nums">
                    {a.rev}
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>
                    {s.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right rail - embedded chat */}
      <aside className="hidden md:flex flex-col min-h-[640px]">
        <DemoChatPanel />
      </aside>
    </motion.div>
  );
}

function AlertCard({
  tone,
  Icon,
  tag,
  body,
  footer,
}: {
  tone: "red" | "orange" | "primary";
  Icon: typeof AlertTriangle;
  tag: string;
  body: React.ReactNode;
  footer?: string;
}) {
  const toneCls = {
    red: { border: "border-taura-red/30", text: "text-taura-red" },
    orange: { border: "border-taura-orange/30", text: "text-taura-orange" },
    primary: { border: "border-primary/30", text: "text-primary" },
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-card rounded-xl p-3 border ${toneCls.border}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 ${toneCls.text}`} />
        <span className={`text-[10px] font-bold tracking-wider ${toneCls.text}`}>{tag}</span>
      </div>
      <div className="text-[11px] text-foreground leading-relaxed">{body}</div>
      {footer && <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">{footer}</div>}
    </motion.div>
  );
}

// ─── VIEW: Campagne (split layout + grouped-by-athlete) ───────────────────
type DelivFilter = "all" | "to_approve" | "to_post" | "completed";

// Derived flags from existing status: approved = status !== draft/to_approve, posted = status === posted
const deriveFlags = (s: DeliverableStatus) => ({
  approved: s === "to_post" || s === "posted",
  posted: s === "posted",
});

const platformMeta: Record<Platform, { label: string; cls: string; Icon: typeof Instagram }> = {
  instagram: { label: "Reel", cls: "bg-primary/15 text-primary border-primary/30", Icon: Instagram },
  tiktok: { label: "TikTok", cls: "bg-foreground/10 text-foreground border-foreground/20", Icon: Music2 },
  youtube: { label: "Short", cls: "bg-taura-red/15 text-taura-red border-taura-red/30", Icon: Youtube },
};

const typeColor: Record<DeliverableType, string> = {
  reel: "bg-taura-purple/15 text-taura-purple border-taura-purple/30",
  post: "bg-taura-blue/15 text-taura-blue border-taura-blue/30",
  story: "bg-taura-orange/15 text-taura-orange border-taura-orange/30",
  short: "bg-taura-red/15 text-taura-red border-taura-red/30",
};

function CampagneView() {
  const [selectedId, setSelectedId] = useState<string | null>(campaigns[0]?.id ?? null);
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="grid md:grid-cols-[1fr_440px] min-h-[640px]"
    >
      <div className="min-w-0 p-5 md:p-6 border-r border-border/40 overflow-hidden">
        <CampaignList onSelect={setSelectedId} selectedId={selectedId} />
      </div>
      <aside className="hidden md:flex flex-col bg-secondary/20">
        {selected ? <CampaignDetail campaign={selected} /> : <CampaignEmpty />}
      </aside>
    </motion.div>
  );
}

function CampaignList({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Campagne</div>
          <h3 className="text-[17px] font-bold tracking-tight">
            <span className="font-mono text-[13px] text-muted-foreground mr-1.5">{campaigns.length}</span>
            attive
          </h3>
        </div>
        <button className="inline-flex items-center gap-1.5 text-[11px] bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:shadow-md hover:shadow-primary/30 transition">
          <Plus className="w-3 h-3" /> Nuova
        </button>
      </div>

      <div className="flex items-center gap-2 bg-secondary/60 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground mb-3">
        <Search className="w-3 h-3" />
        <span>Cerca campagna o brand...</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {campaigns.map((c, i) => {
          const s = campaignStatusLabel[c.status];
          const total = c.deliverables.length;
          const approved = c.deliverables.filter((d) => deriveFlags(d.status).approved).length;
          const posted = c.deliverables.filter((d) => deriveFlags(d.status).posted).length;
          const missing = total - approved;
          const pctPosted = Math.round((posted / total) * 100);
          const pctApproved = Math.round((approved / total) * 100);
          const active = selectedId === c.id;
          return (
            <motion.button
              key={c.id}
              onClick={() => onSelect(c.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
              className={`text-left w-full bg-card rounded-xl border p-3 transition-all ${
                active
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/40 hover:border-primary/30 hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-foreground truncate">{c.title}</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">{c.brand}</div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>{s.label}</span>
              </div>

              {/* Dual progress bars */}
              <div className="space-y-1.5 mb-2">
                <div>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Approvaz.</span>
                    <span className="text-[9.5px] font-mono text-muted-foreground tabular-nums">{pctApproved}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pctApproved}%` }}
                      transition={{ duration: 0.7, delay: 0.15 + i * 0.04, ease: EASE }}
                      className="h-full bg-taura-green rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Pubbl.</span>
                    <span className="text-[9.5px] font-mono text-muted-foreground tabular-nums">{pctPosted}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pctPosted}%` }}
                      transition={{ duration: 0.7, delay: 0.25 + i * 0.04, ease: EASE }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {posted}/{total} post · {approved} approvati · {missing} da fare
                </div>
                <div className="flex -space-x-1.5">
                  {c.talents.slice(0, 3).map((t, idx) => (
                    <div
                      key={idx}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-card"
                      style={{ background: t.color }}
                    >
                      {t.init}
                    </div>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function CampaignEmpty() {
  return (
    <div className="flex-1 flex items-center justify-center p-10 text-center">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center mx-auto mb-3">
          <Megaphone className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-[13px] font-semibold text-foreground mb-1">Seleziona una campagna</div>
        <div className="text-[11px] text-muted-foreground max-w-[240px]">
          Clicca a sinistra per gestire deliverable, approvazioni e pubblicazioni.
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const [filter, setFilter] = useState<DelivFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Record<string, { approved: boolean; posted: boolean }>>(() => {
    const init: Record<string, { approved: boolean; posted: boolean }> = {};
    campaign.deliverables.forEach((d) => {
      init[d.id] = deriveFlags(d.status);
    });
    return init;
  });

  const getFlags = (id: string) => flags[id] ?? { approved: false, posted: false };

  const counts = {
    all: campaign.deliverables.length,
    to_approve: campaign.deliverables.filter((d) => !getFlags(d.id).approved).length,
    to_post: campaign.deliverables.filter((d) => getFlags(d.id).approved && !getFlags(d.id).posted).length,
    completed: campaign.deliverables.filter((d) => getFlags(d.id).posted).length,
  };

  const filtered = campaign.deliverables.filter((d) => {
    const f = getFlags(d.id);
    if (filter === "all") return true;
    if (filter === "to_approve") return !f.approved;
    if (filter === "to_post") return f.approved && !f.posted;
    return f.posted;
  });

  const grouped = filtered.reduce<Record<string, Deliverable[]>>((acc, d) => {
    const key = d.talent.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const status = campaignStatusLabel[campaign.status];

  const toggle = (id: string, key: "approved" | "posted") => {
    setFlags((prev) => {
      const current = prev[id] ?? { approved: false, posted: false };
      const next = { ...current, [key]: !current[key] };
      if (key === "posted" && next.posted) next.approved = true;
      if (key === "approved" && !next.approved) next.posted = false;
      return { ...prev, [id]: next };
    });
  };

  return (
    <motion.div
      key={campaign.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full min-h-[640px]"
    >
      {/* Detail header - sticky */}
      <div className="px-5 py-4 border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-0.5">
              {campaign.brand}
            </div>
            <h3 className="text-[15px] font-bold tracking-tight text-foreground leading-tight">
              {campaign.title}
            </h3>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${status.cls}`}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground bg-secondary/60 border border-border/40 rounded-md px-2 py-1 hover:text-foreground hover:border-primary/30 transition">
            <Upload className="w-3 h-3" /> Brief
          </button>
          <button className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground bg-secondary/60 border border-border/40 rounded-md px-2 py-1 hover:text-foreground hover:border-primary/30 transition">
            <FileText className="w-3 h-3" /> Proof
          </button>
          <div className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
            {campaign.budget} · {campaign.endDate}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-2 border-b border-border/40 overflow-x-auto">
        <TabPill label="Tutti" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <TabPill
          label="Da approvare"
          count={counts.to_approve}
          active={filter === "to_approve"}
          onClick={() => setFilter("to_approve")}
        />
        <TabPill
          label="Da pubblicare"
          count={counts.to_post}
          active={filter === "to_post"}
          onClick={() => setFilter("to_post")}
        />
        <TabPill
          label="Completati"
          count={counts.completed}
          active={filter === "completed"}
          onClick={() => setFilter("completed")}
        />
      </div>

      {/* Grouped deliverables */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-10 text-[12px] text-muted-foreground">
            Nessun deliverable in questo stato.
          </div>
        )}
        {Object.entries(grouped).map(([athleteName, items]) => {
          const first = items[0];
          return (
            <div key={athleteName}>
              {/* Athlete header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: first.talent.color }}
                >
                  {first.talent.init}
                </div>
                <span className="text-[12px] font-semibold text-foreground">{first.talent.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums ml-1">
                  {items.length}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    title="Copia brief"
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    title="Invia via email"
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Deliverable rows */}
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {items.map((d, i) => (
                    <DeliverableRow
                      key={d.id}
                      deliverable={d}
                      index={i}
                      flags={getFlags(d.id)}
                      isExpanded={expanded.has(d.id)}
                      onToggleExpand={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id);
                          else next.add(d.id);
                          return next;
                        })
                      }
                      onToggleFlag={(key) => toggle(d.id, key)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI hint bar */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-primary/5">
        <div className="flex items-start gap-2 text-[10.5px] text-muted-foreground leading-relaxed">
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1"
            style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.6)" }}
          />
          <span>
            <span className="text-primary font-semibold">Tutto anche via AI:</span>{" "}
            <span className="font-mono text-foreground/80">"approva tutti i reel Nike"</span>,{" "}
            <span className="font-mono text-foreground/80">"sposta Drop Day al 26 mag"</span>,{" "}
            <span className="font-mono text-foreground/80">"modifica il brief di Matchday"</span>.
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {label}
      <span className="font-mono tabular-nums text-[10px] opacity-80">{count}</span>
    </button>
  );
}

type DeliverableRowProps = {
  deliverable: Deliverable;
  index: number;
  flags: { approved: boolean; posted: boolean };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleFlag: (k: "approved" | "posted") => void;
};

const DeliverableRow = forwardRef<HTMLDivElement, DeliverableRowProps>(function DeliverableRow(
  { deliverable: d, index, flags, isExpanded, onToggleExpand, onToggleFlag },
  ref,
) {
  const typeKey = d.type;
  const typeCls = typeColor[typeKey];
  const PlatformIcon = platformIcon[d.platform];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.18) }}
      className="bg-card border border-border/40 rounded-lg hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Type pill */}
        <span
          className={`inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${typeCls}`}
        >
          <PlatformIcon className="w-2.5 h-2.5" />
          {d.type}
        </span>

        {/* Title + date */}
        <div className="flex-1 min-w-0">
          <div className="text-[11.5px] font-semibold text-foreground truncate">{d.title}</div>
        </div>

        <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
          {d.scheduledDate}
        </span>

        {/* Expand chevron */}
        <button
          onClick={onToggleExpand}
          className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
          aria-label={isExpanded ? "Chiudi dettagli" : "Apri dettagli"}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Status pills */}
        <StatusPill
          label="Approvato"
          labelInactive="Approva"
          checked={flags.approved}
          onClick={() => onToggleFlag("approved")}
          tone="green"
        />
        <StatusPill
          label="Pubblicato"
          labelInactive="Pubblica"
          checked={flags.posted}
          onClick={() => onToggleFlag("posted")}
          tone="primary"
          disabled={!flags.approved}
        />
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="px-3 py-2.5 bg-secondary/30">
              <div className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase mb-1">
                Brief AI
              </div>
              <p className="text-[11px] text-foreground leading-relaxed">{d.brief}</p>
              {d.metrics && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5" />
                    <span className="font-mono font-semibold text-foreground tabular-nums">{d.metrics.reach}</span>
                    reach
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" />
                    <span className="font-mono font-semibold text-foreground tabular-nums">{d.metrics.eng}</span>
                    eng
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

function StatusPill({
  label,
  labelInactive,
  checked,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  labelInactive: string;
  checked: boolean;
  onClick: () => void;
  tone: "green" | "primary";
  disabled?: boolean;
}) {
  const activeCls =
    tone === "green"
      ? "bg-taura-green/15 text-taura-green border-taura-green/40"
      : "bg-primary/15 text-primary border-primary/40";
  const inactiveCls =
    "bg-transparent text-muted-foreground border-border/60 hover:border-foreground/30 hover:text-foreground";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Prima approva il deliverable" : checked ? `${label} - click per annullare` : `Click per: ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1 shrink-0 h-6 px-2 rounded-md border text-[10px] font-semibold tracking-tight transition-all ${
        checked ? activeCls : inactiveCls
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 transition-all ${
          checked
            ? tone === "green"
              ? "bg-taura-green border-taura-green"
              : "bg-primary border-primary"
            : "border-current"
        }`}
      >
        {checked && <CheckCircle2 className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </span>
      <span>{checked ? label : labelInactive}</span>
    </button>
  );
}

// ─── VIEW: Roster ────────────────────────────────────────────────────────
function RosterView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="p-5 md:p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Roster</div>
          <h3 className="text-[17px] font-bold tracking-tight">5 talent gestiti</h3>
        </div>
        <button className="inline-flex items-center gap-1.5 text-[11px] bg-primary/15 text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/25 transition">
          <Plus className="w-3 h-3" /> Aggiungi talent
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {athletes.map((a, i) => {
          const s = statusLabel[a.status];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="bg-secondary/40 rounded-xl border border-border/40 p-4 hover:border-primary/30 hover:bg-secondary/60 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                  style={{ background: a.color }}
                >
                  {a.init}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-foreground truncate">{a.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">{a.team}</div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <RosterStat label="Revenue" value={a.rev} />
                <RosterStat label="Reach" value={a.reach} />
                <RosterStat label="Contratti" value={String(a.contracts)} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function RosterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/40 rounded-lg border border-border/30 py-2 px-1.5">
      <div className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">{label}</div>
      <div className="text-[13px] font-mono font-bold text-foreground tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

// ─── VIEW: Calendario ────────────────────────────────────────────────────
function CalendarioView() {
  const daysInMonth = 30;
  const firstWeekday = 2;
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="p-5 md:p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Calendario</div>
          <h3 className="text-[17px] font-bold tracking-tight">Aprile 2026 · 9 eventi</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Deliverable
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-taura-orange/15 text-taura-orange border border-taura-orange/30">
            <span className="w-1.5 h-1.5 rounded-full bg-taura-orange" /> Rinnovo
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-taura-blue/15 text-taura-blue border border-taura-blue/30">
            <span className="w-1.5 h-1.5 rounded-full bg-taura-blue" /> Meeting
          </span>
        </div>
      </div>

      <div className="bg-secondary/40 rounded-xl border border-border/40 overflow-hidden">
        <div className="grid grid-cols-7 text-[9px] font-bold text-muted-foreground tracking-wider uppercase border-b border-border/40 bg-secondary/40">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const evts = day ? calendarEvents.filter((e) => e.day === day) : [];
            return (
              <div
                key={idx}
                className={`border-r border-b border-border/30 min-h-[70px] md:min-h-[86px] p-1.5 ${
                  day ? "" : "bg-secondary/20"
                }`}
              >
                {day && (
                  <>
                    <div className="text-[10px] font-mono text-muted-foreground mb-1 tabular-nums">{day}</div>
                    <div className="space-y-1">
                      {evts.slice(0, 2).map((e, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.2 + idx * 0.008 }}
                          className={`text-[9px] font-semibold leading-tight rounded px-1 py-0.5 border truncate ${eventTint[e.type]}`}
                          title={e.label}
                        >
                          {e.label}
                        </motion.div>
                      ))}
                      {evts.length > 2 && (
                        <div className="text-[9px] text-muted-foreground">+{evts.length - 2}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        Gli eventi vengono creati in automatico da contratti, campagne e alert AI.
      </div>
    </motion.div>
  );
}
