DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'blood_work_records'
    AND con.contype = 'f'
    AND con.conkey = ARRAY[
      (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = rel.oid
          AND attname = 'user_id'
      )
    ];

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.blood_work_records DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.blood_work_records
  ADD CONSTRAINT blood_work_records_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
