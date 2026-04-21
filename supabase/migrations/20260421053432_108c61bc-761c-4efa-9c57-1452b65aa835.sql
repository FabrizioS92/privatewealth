CREATE TABLE public.price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  isin text NOT NULL,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own price history"
ON public.price_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own price history"
ON public.price_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own price history"
ON public.price_history FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_price_history_user_isin_recorded
ON public.price_history (user_id, isin, recorded_at DESC);