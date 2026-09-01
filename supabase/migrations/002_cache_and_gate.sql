-- 유사 질문 숏컷 + 자주 묻는 질문 집계
-- 001을 적용한 뒤에 돌린다. (적용 완료 — Supabase에 반영됨)

-- 한글도 trigram이 잡힌다. 질문이 조금씩 달라도("암 진단비 면책" / "암진단비 면책기간")
-- 같은 질문으로 묶으려면 정확 일치만으로는 부족하다.
create extension if not exists pg_trgm;

create index if not exists clause_cache_norm_trgm
  on clause_cache using gin (norm gin_trgm_ops);

-- 임계값을 넘는 것 중 가장 가까운 하나.
-- 부르는 쪽에서 0.90 이상이면 그대로 답하고, 그 아래는 모델에게 참고로만 넘긴다 —
-- 애매하게 비슷한 질문의 답을 그대로 주면 틀린 답을 재활용하게 된다.
create or replace function match_cached_question(q text)
returns table (question text, answer text, cards text[], sim real)
language sql stable
set search_path = public, pg_temp
as $$
  select c.question, c.answer, c.cards, similarity(c.norm, q) as sim
  from clause_cache c
  where c.norm is not null and c.norm % q
  order by similarity(c.norm, q) desc
  limit 1
$$;

create or replace function touch_cache(h text)
returns void
language sql
set search_path = public, pg_temp
as $$
  update clause_cache set hits = hits + 1, used_at = now() where q_hash = h
$$;

-- 자주 묻는 질문 — 표현이 달라도 묶어서 센다.
create or replace view faq_top as
  select
    min(question)                        as sample,
    count(*)                             as asked,
    count(*) filter (where helpful = 1)  as good,
    count(*) filter (where helpful = -1) as bad,
    max(created_at)                      as last_asked
  from chat_logs
  where answer is not null and error is null and blocked = false
  group by regexp_replace(lower(question), '[[:space:][:punct:]]', '', 'g')
  order by count(*) desc;
