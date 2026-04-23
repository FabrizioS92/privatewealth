/**
 * Map Supabase / PostgREST / Auth errors to safe, user-friendly Italian
 * messages. Never expose raw `error.message` (it may contain constraint
 * names, column types or internal schema details).
 */

interface MaybeSupabaseError {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
}

const GENERIC = "Si è verificato un errore. Riprova.";

const PG_CODE_MAP: Record<string, string> = {
  "23505": "Voce duplicata: esiste già un record con questi dati.",
  "23503": "Operazione non consentita: dati collegati mancanti.",
  "23502": "Manca un campo obbligatorio.",
  "23514": "Alcuni valori non sono validi.",
  "22P02": "Formato dei dati non valido.",
  "42501": "Non hai i permessi per questa operazione.",
  PGRST301: "Sessione scaduta. Effettua di nuovo l'accesso.",
};

const AUTH_KEYWORD_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email o password non corretti."],
  [/email not confirmed/i, "Conferma la tua email prima di accedere."],
  [/user already registered/i, "Esiste già un account con questa email."],
  [/password should be at least/i, "La password è troppo corta."],
  [/rate limit/i, "Troppi tentativi. Riprova tra qualche minuto."],
  [/network|fetch failed|failed to fetch/i, "Problema di connessione. Riprova."],
];

export function friendlyError(error: unknown, fallback: string = GENERIC): string {
  // Always log the full error in dev for debugging
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error("[friendlyError]", error);
  }

  if (!error) return fallback;

  const e = error as MaybeSupabaseError;

  if (e.code && PG_CODE_MAP[e.code]) {
    return PG_CODE_MAP[e.code];
  }

  const msg = typeof e.message === "string" ? e.message : "";
  for (const [re, text] of AUTH_KEYWORD_MAP) {
    if (re.test(msg)) return text;
  }

  return fallback;
}
