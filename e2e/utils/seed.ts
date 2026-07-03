import { supabase } from '@/integrations/supabase/client';

const SEED_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function seedTestData() {
  const { error } = await supabase.rpc('seed_e2e_test_data', {
    p_user_id: SEED_USER_ID,
  });

  if (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

export async function cleanupTestData() {
  const { error } = await supabase.rpc('cleanup_e2e_test_data', {
    p_user_id: SEED_USER_ID,
  });

  if (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
}
