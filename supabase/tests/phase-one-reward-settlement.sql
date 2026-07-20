BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, security, extensions, pg_temp;

SELECT plan(39);

CREATE TEMP TABLE phase_one_reward_results (
  result_key TEXT PRIMARY KEY,
  result JSONB NOT NULL
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'reward-direct@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'reward-versioned@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'reward-unauthorized@local.test', '', now(),
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_challenges (
  id, title, challenge_type, target_value, start_date, end_date,
  reward_points, xp_reward, wallet_reward_amount, is_active
) VALUES
  (
    '82000000-0000-4000-8000-000000000001',
    'Direct settlement fixture', 'steps', 1, current_date - 1, current_date + 1,
    0, 0, 10, true
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'Versioned settlement fixture', 'steps', 1, current_date - 1, current_date + 1,
    0, 0, 5, true
  );

INSERT INTO public.challenge_participants (
  id, challenge_id, user_id, current_progress
) VALUES
  (
    '83000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001', 0
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002', 1
  );

INSERT INTO public.customer_wallets (
  user_id, balance, total_credits, total_debits, is_active, reward_adjustment_due
) VALUES
  ('81000000-0000-4000-8000-000000000001', 0, 0, 0, true, 0),
  ('81000000-0000-4000-8000-000000000002', 0, 0, 0, true, 0)
ON CONFLICT (user_id) DO UPDATE SET
  balance = 0,
  total_credits = 0,
  total_debits = 0,
  is_active = true,
  reward_adjustment_due = 0;

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'grant-v1', public.grant_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1, 'direct-settlement:v1', 10, 'Direct settlement fixture'
);

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'grant-v1-replay', public.grant_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1, 'direct-settlement:v1', 10, 'Direct settlement fixture'
);

SELECT is(
  (SELECT result->>'duplicate' FROM phase_one_reward_results WHERE result_key = 'grant-v1'),
  'false',
  'the first wallet grant is not a duplicate'
);

SELECT is(
  (SELECT result->>'duplicate' FROM phase_one_reward_results WHERE result_key = 'grant-v1-replay'),
  'true',
  'a replayed wallet grant is reported as a duplicate'
);

SELECT is(
  (SELECT count(*) FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000001' AND completion_version = 1),
  1::BIGINT,
  'a duplicate grant creates one settlement row'
);

SELECT is(
  (SELECT balance FROM public.customer_wallets WHERE user_id = '81000000-0000-4000-8000-000000000001'),
  10.00::NUMERIC,
  'a duplicate grant credits the wallet only once'
);

SELECT is(
  (SELECT count(*) FROM public.wallet_transactions
   WHERE idempotency_key = 'challenge-reward:81000000-0000-4000-8000-000000000001:direct-settlement:v1'),
  1::BIGINT,
  'a duplicate grant creates one wallet ledger entry'
);

SELECT is(
  (SELECT count(*) FROM public.reward_transactions
   WHERE user_id = '81000000-0000-4000-8000-000000000001'
     AND metadata->>'source_key' = 'direct-settlement:v1'),
  1::BIGINT,
  'a duplicate grant creates one reward audit entry'
);

-- Simulate spending eight of the ten credited riyals before evidence is invalidated.
UPDATE public.customer_wallets
SET balance = 2
WHERE user_id = '81000000-0000-4000-8000-000000000001';

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'reverse-v1', public.reverse_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1, 'Evidence invalidated by database test'
);

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'reverse-v1-replay', public.reverse_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1, 'Evidence invalidated by database test'
);

SELECT is(
  (SELECT result->>'duplicate' FROM phase_one_reward_results WHERE result_key = 'reverse-v1'),
  'false',
  'the first reversal is not a duplicate'
);

SELECT ok(
  (SELECT (result->>'debited_amount')::NUMERIC = 2 AND (result->>'pending_recovery')::NUMERIC = 8
   FROM phase_one_reward_results WHERE result_key = 'reverse-v1'),
  'reversal debits available funds and records the unrecovered gross reward'
);

SELECT is(
  (SELECT result->>'duplicate' FROM phase_one_reward_results WHERE result_key = 'reverse-v1-replay'),
  'true',
  'a replayed reversal is reported as a duplicate'
);

SELECT ok(
  (SELECT balance = 0 AND total_debits = 2 AND reward_adjustment_due = 8
   FROM public.customer_wallets WHERE user_id = '81000000-0000-4000-8000-000000000001'),
  'a duplicate reversal does not double-debit or double the pending recovery'
);

SELECT is(
  (SELECT count(*) FROM public.wallet_transactions
   WHERE idempotency_key = 'challenge-reversal:81000000-0000-4000-8000-000000000001:direct-settlement:v1'),
  1::BIGINT,
  'a duplicate reversal creates one compensating wallet entry'
);

SELECT ok(
  (SELECT status = 'reversed' AND reversed_debit_amount = 2 AND pending_recovery_amount = 8
   FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000001' AND completion_version = 1),
  'the version-one settlement preserves reversal and recovery audit values'
);

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'grant-v2', public.grant_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  2, 'direct-settlement:v2', 10, 'Direct settlement fixture'
);

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'grant-v2-replay', public.grant_community_challenge_wallet_reward(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  2, 'direct-settlement:v2', 10, 'Direct settlement fixture'
);

SELECT ok(
  (SELECT (result->>'recovery_applied')::NUMERIC = 8 AND (result->>'credited_amount')::NUMERIC = 2
   FROM phase_one_reward_results WHERE result_key = 'grant-v2'),
  'a later achievement settles pending recovery before crediting the remainder'
);

SELECT ok(
  (SELECT balance = 2 AND reward_adjustment_due = 0
   FROM public.customer_wallets WHERE user_id = '81000000-0000-4000-8000-000000000001'),
  'pending recovery is cleared without making the wallet negative'
);

SELECT is(
  (SELECT count(*) FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000001'),
  2::BIGINT,
  'a new completion version creates a distinct immutable settlement'
);

SELECT is(
  (SELECT result->>'duplicate' FROM phase_one_reward_results WHERE result_key = 'grant-v2-replay'),
  'true',
  'the new completion version remains replay-safe'
);

SELECT is(
  (SELECT count(*) FROM public.wallet_transactions
   WHERE user_id = '81000000-0000-4000-8000-000000000001'
     AND reference_type = 'community_challenge'),
  3::BIGINT,
  'grant, reversal, and re-achievement produce exactly three wallet entries'
);

-- Exercise the installed progress state machine: qualify, lose evidence, qualify again.
INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'apply-v1', public.apply_community_challenge_progress(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);

SELECT ok(
  (SELECT (result->>'completed')::BOOLEAN AND (result->>'reward_version')::INTEGER = 1
   FROM phase_one_reward_results WHERE result_key = 'apply-v1'),
  'verified progress awards completion version one'
);

SELECT ok(
  (SELECT completion_version = 1 AND completed_at IS NOT NULL
   FROM public.challenge_participants WHERE id = '83000000-0000-4000-8000-000000000002'),
  'the participant records the first completed version'
);

SELECT ok(
  (SELECT status = 'granted' AND gross_amount = 5 AND credited_amount = 5
   FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000002' AND completion_version = 1),
  'version one has a granted wallet settlement'
);

UPDATE public.challenge_participants
SET current_progress = 0
WHERE id = '83000000-0000-4000-8000-000000000002';

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'apply-reversal', public.apply_community_challenge_progress(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);

SELECT is(
  (SELECT result->>'completed' FROM phase_one_reward_results WHERE result_key = 'apply-reversal'),
  'false',
  'lost evidence removes completed state'
);

SELECT ok(
  (SELECT completed_at IS NULL AND completion_version = 1 AND reward_reversed_at IS NOT NULL
   FROM public.challenge_participants WHERE id = '83000000-0000-4000-8000-000000000002'),
  'reversal preserves the completion version for the next achievement'
);

SELECT is(
  (SELECT status FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000002' AND completion_version = 1),
  'reversed',
  'lost evidence reverses the version-one settlement'
);

UPDATE public.challenge_participants
SET current_progress = 1
WHERE id = '83000000-0000-4000-8000-000000000002';

INSERT INTO phase_one_reward_results (result_key, result)
SELECT 'apply-v2', public.apply_community_challenge_progress(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);

SELECT ok(
  (SELECT (result->>'completed')::BOOLEAN AND (result->>'reward_version')::INTEGER = 2
   FROM phase_one_reward_results WHERE result_key = 'apply-v2'),
  're-achievement awards a new completion version'
);

SELECT ok(
  (SELECT completion_version = 2 AND completed_at IS NOT NULL
   FROM public.challenge_participants WHERE id = '83000000-0000-4000-8000-000000000002'),
  'the participant advances to completion version two'
);

SELECT is(
  (SELECT string_agg(completion_version::TEXT || ':' || status, ',' ORDER BY completion_version)
   FROM public.community_challenge_reward_settlements
   WHERE participant_id = '83000000-0000-4000-8000-000000000002'),
  '1:reversed,2:granted',
  're-achievement keeps the reversed version and grants a new version'
);

SELECT is(
  (SELECT balance FROM public.customer_wallets WHERE user_id = '81000000-0000-4000-8000-000000000002'),
  5.00::NUMERIC,
  'qualify, reverse, and re-qualify leaves one net wallet reward'
);

-- One pgTAP transaction cannot create a second blocking session. Prove the installed
-- serialization primitives and uniqueness backstops deterministically instead.
SELECT ok(
  pg_get_functiondef(
    'public.grant_community_challenge_wallet_reward(uuid,uuid,uuid,integer,text,numeric,text)'::REGPROCEDURE
  ) ~ 'pg_advisory_xact_lock',
  'grant settlement serializes matching source keys with an advisory transaction lock'
);

SELECT ok(
  position(
    'pg_advisory_xact_lock' IN lower(pg_get_functiondef(
      'public.reverse_community_challenge_wallet_reward(uuid,uuid,integer,text)'::REGPROCEDURE
    ))
  ) > 0
  AND position(
    'for update' IN lower(pg_get_functiondef(
      'public.reverse_community_challenge_wallet_reward(uuid,uuid,integer,text)'::REGPROCEDURE
    ))
  ) > position(
    'pg_advisory_xact_lock' IN lower(pg_get_functiondef(
      'public.reverse_community_challenge_wallet_reward(uuid,uuid,integer,text)'::REGPROCEDURE
    ))
  ),
  'reversal serializes matching requests and row-locks the settlement'
);

SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.community_challenge_reward_settlements'::REGCLASS
     AND contype = 'u'
     AND pg_get_constraintdef(oid) = 'UNIQUE (participant_id, completion_version)'),
  1::BIGINT,
  'the database uniquely enforces one settlement per participant version'
);

SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.community_challenge_reward_settlements'::REGCLASS
     AND contype = 'u'
     AND pg_get_constraintdef(oid) = 'UNIQUE (source_key)'),
  1::BIGINT,
  'the database uniquely enforces settlement source keys'
);

SELECT is(
  (SELECT count(*) FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'wallet_transactions'
     AND indexdef LIKE '%UNIQUE%user_id, idempotency_key%WHERE (idempotency_key IS NOT NULL)%'),
  1::BIGINT,
  'wallet idempotency keys have a partial unique index'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.grant_community_challenge_wallet_reward(uuid,uuid,uuid,integer,text,numeric,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.reverse_community_challenge_wallet_reward(uuid,uuid,integer,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.apply_community_challenge_progress(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.sync_community_challenge_progress_for_user(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.grant_community_challenge_wallet_reward(uuid,uuid,uuid,integer,text,numeric,text)',
    'EXECUTE'
  ),
  'authenticated customers cannot execute internal settlement RPCs'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.sync_my_community_challenges()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.sync_my_community_challenges()', 'EXECUTE'),
  'authenticated customers can execute only the auth.uid-scoped challenge sync RPC'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $sql$
    SELECT public.grant_community_challenge_wallet_reward(
      '81000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      3, 'unauthorized:v3', 10, 'Unauthorized attempt'
    )
  $sql$,
  '42501',
  'permission denied for function grant_community_challenge_wallet_reward',
  'a customer cannot forge a direct reward grant RPC call'
);

SELECT is(
  (SELECT count(*) FROM public.community_challenge_reward_settlements),
  2::BIGINT,
  'settlement RLS exposes only the current customer rows'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.community_challenge_reward_settlements),
  0::BIGINT,
  'settlement RLS hides every other customer settlement'
);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.community_challenge_reward_settlements',
    'INSERT'
  ),
  'settlement grants reject direct customer inserts before RLS evaluation'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.community_challenge_reward_settlements',
    'SELECT'
  ),
  'anonymous callers have no read grant on reward settlements'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
