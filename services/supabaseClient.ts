import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjlqgwnqsjmdyugymnpm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbHFnd25xc2ptZHl1Z3ltbnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDM0MTMsImV4cCI6MjA4MDc3OTQxM30.tCU8My3WiW7ey0-g2uUEiyuE0XWFFNNPnblN8ckxISE";

export const supabase = createClient(supabaseUrl, supabaseKey);