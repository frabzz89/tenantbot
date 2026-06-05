import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Graceful: if env vars are not set on the landing app, auth detection is skipped
export const supabase = url && key ? createClient(url, key) : null
