import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/supabase'

let supabaseClient: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const createClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient<Database>()
  }
  return supabaseClient!
} 