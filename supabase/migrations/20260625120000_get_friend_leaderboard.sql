create or replace function get_friend_leaderboard(p_user_id uuid)
returns table(
  friend_user_id uuid,
  friend_name text,
  friend_avatar text,
  current_streak integer,
  xp integer,
  level integer,
  total_meals_logged integer,
  nutrition_score integer,
  composite_score bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with friend_ids as (
    select p_user_id as uid
    where p_user_id = auth.uid()
    union
    select case when f.requester_id = p_user_id then f.target_id else f.requester_id end as uid
    from friendships f
    where p_user_id = auth.uid()
      and f.status = 'accepted'
      and (f.requester_id = p_user_id or f.target_id = p_user_id)
  ),
  latest_nutrition as (
    select distinct on (dps.user_id)
      dps.user_id,
      dps.nutrition_score
    from daily_performance_snapshots dps
    where dps.user_id in (select uid from friend_ids)
       or dps.user_id = p_user_id
    order by dps.user_id, dps.snapshot_date desc
  )
  select
    p.user_id,
    coalesce(p.full_name, 'Unknown'),
    p.avatar_url,
    coalesce(p.streak_days, 0)::integer,
    coalesce(p.xp, 0)::integer,
    coalesce(p.level, 0)::integer,
    coalesce(p.total_meals_logged, 0)::integer,
    coalesce(ln.nutrition_score, 0)::integer,
    (
      coalesce(p.streak_days, 0) * 3 +
      coalesce(p.xp, 0) / 20 +
      coalesce(ln.nutrition_score, 0) +
      coalesce(p.total_meals_logged, 0) * 2
    )::bigint as composite_score
  from friend_ids fi
  join profiles p on p.user_id = fi.uid
  left join latest_nutrition ln on ln.user_id = fi.uid
  order by composite_score desc;
$$;

revoke all on function get_friend_leaderboard(uuid) from public, anon;
grant execute on function get_friend_leaderboard(uuid) to authenticated, service_role;
