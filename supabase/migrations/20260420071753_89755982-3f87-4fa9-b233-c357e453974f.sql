UPDATE public.transactions
SET currency = 'EUR'
WHERE currency IS NULL
   OR currency !~ '^[A-Z]{3}$';

CREATE OR REPLACE FUNCTION public.normalize_transaction_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.currency := UPPER(TRIM(COALESCE(NEW.currency, 'EUR')));
  IF NEW.currency !~ '^[A-Z]{3}$' THEN
    NEW.currency := 'EUR';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_transaction_currency_trigger ON public.transactions;
CREATE TRIGGER normalize_transaction_currency_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_transaction_currency();

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_currency_format;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_currency_format
CHECK (currency ~ '^[A-Z]{3}$');