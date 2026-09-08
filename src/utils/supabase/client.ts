import { createBrowserClient } from '@supabase/ssr';
import { supabaseKey, supabaseUrl } from './env';

/** The Supabase client for client components. */
export const createClient = () => createBrowserClient(supabaseUrl(), supabaseKey());
