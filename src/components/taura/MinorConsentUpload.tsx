import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MinorConsentUploadProps {
  athleteId?: string;
  agencyId: string;
  existingUrl?: string | null;
  onUploaded: (url: string) => void;
}

const MinorConsentUpload = ({ athleteId, agencyId, existingUrl, onUploaded }: MinorConsentUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(!!existingUrl);

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("File troppo grande (max 10MB)");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Formato non supportato (PDF, JPG o PNG)");
      return;
    }
    setUploading(true);
    try {
      const path = `${agencyId}/${athleteId ?? "pending"}/${Date.now()}_${file.name}`;
      const { data, error: upErr } = await supabase.storage
        .from("parental-consents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      onUploaded(data.path);
      setUploaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h4 className="text-[13px] font-semibold text-foreground">Consenso genitoriale richiesto</h4>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
            L'atleta è minorenne. Carica il modulo di consenso firmato da un genitore o tutore legale.
            Art. 8 GDPR + Art. 2-quinquies Codice Privacy.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        aria-label="Carica modulo consenso genitoriale"
      />

      {uploaded ? (
        <div className="flex items-center gap-2 text-[12px] text-green-600 dark:text-green-400 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span>Consenso caricato correttamente</span>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <>Caricamento...</>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              Carica PDF / JPG
            </>
          )}
        </button>
      )}

      {error && (
        <div role="alert" className="mt-2 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}

      {existingUrl && (
        <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Documento presente agli atti
        </div>
      )}
    </div>
  );
};

export default MinorConsentUpload;
