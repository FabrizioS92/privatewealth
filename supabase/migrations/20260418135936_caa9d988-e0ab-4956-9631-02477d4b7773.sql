-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Transactions (DEGIRO import)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  isin TEXT NOT NULL,
  ticker TEXT,
  name TEXT NOT NULL,
  exchange TEXT,
  type TEXT NOT NULL CHECK (type IN ('buy','sell')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  fx_rate NUMERIC DEFAULT 1,
  fees NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  dedup_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'degiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedup_hash)
);
CREATE INDEX idx_tx_user_isin ON public.transactions(user_id, isin);
CREATE INDEX idx_tx_user_date ON public.transactions(user_id, trade_date DESC);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Dividends
CREATE TABLE public.dividends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_date DATE NOT NULL,
  isin TEXT NOT NULL,
  ticker TEXT,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  withholding_tax NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  dedup_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'degiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedup_hash)
);
CREATE INDEX idx_div_user_isin ON public.dividends(user_id, isin);
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own dividends" ON public.dividends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own dividends" ON public.dividends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dividends" ON public.dividends FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own dividends" ON public.dividends FOR DELETE USING (auth.uid() = user_id);

-- Manual prices
CREATE TABLE public.manual_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isin TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, isin)
);
ALTER TABLE public.manual_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own prices" ON public.manual_prices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prices" ON public.manual_prices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prices" ON public.manual_prices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own prices" ON public.manual_prices FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, base_currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'EUR'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();