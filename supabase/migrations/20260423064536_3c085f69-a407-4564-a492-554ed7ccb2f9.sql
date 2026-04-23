-- Allow users to delete their own profile
CREATE POLICY "Users delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);