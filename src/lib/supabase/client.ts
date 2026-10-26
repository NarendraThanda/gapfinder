import { createBrowserClient } from '@supabase/ssr'

const DEFAULT_SUPABASE_URL = 'https://ypjbmvyvemelyxfunjij.supabase.co'
const DEFAULT_SUPABASE_KEY = 'sb_publishable_hmShbJqldzsu1p3oSu6rbQ_4US-kiBg'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    )
  }

  return createBrowserClient(url, key)
}
