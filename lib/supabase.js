// Cliente Supabase compartilhado por todo o app.
// Usa a publishable key (segura para o frontend; o RLS protege os dados).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://wrthfglfyltdwffkifdf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qTy3wBKD6mNriIg_ULE3ug_DZLJymqI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // necessário pro retorno do OAuth (Google)
  },
});
