import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ✅ PERBAIKAN: Potong URL tepat setelah eksternal domain .co
const supabaseUrl = 'https://nvsbkcbbgmyytxalzbqu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52c2JrY2JiZ215eXR4YWx6YnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4Mzc1MDAsImV4cCI6MjEwNjQxMzUwMH0.52CrP5xRNM_0w-dCWC8iib9SV3CH-5HQzhhfH4u283Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
