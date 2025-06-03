import {createClient} from'@supabase/supabase-js'

const supabaseUrl = 'https://xbvpryptfofkgbkqjtzj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhidnByeXB0Zm9ma2dia3FqdHpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyOTc1MjAsImV4cCI6MjA2Mzg3MzUyMH0.z2n0H2y6ku56CUxkqSBllHzRYELEc1K4nipfITW4AgE'

export const supabase = createClient(supabaseUrl, supabaseKey)