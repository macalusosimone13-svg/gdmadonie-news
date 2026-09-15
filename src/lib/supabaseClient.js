import { createClient } from '@supabase/supabase-js';

// Chiave "anon public": pensata per stare nel codice del sito, protetta
// dalle regole RLS impostate sul database, non è un segreto.
const SUPABASE_URL = 'https://fxfckcpdxuyrhuinkyxq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4ZmNrY3BkeHV5cmh1aW5reXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Njc2NDAsImV4cCI6MjEwNTA0MzY0MH0.FVIFZkQ5enyTSKBy8tlYDYvbI36w1P9ZnT0C7Metd_k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
