import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY richiesti in .env.local')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
