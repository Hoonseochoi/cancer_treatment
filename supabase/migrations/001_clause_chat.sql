-- 슈린슈 AI(약관 검색기) 저장소
-- 기존 테이블은 건드리지 않고 새로 셋만 만든다.

-- ── 약관 본문 ──
-- 브라우저에는 경량 인덱스만 두고(256KB), 5MB짜리 본문은 여기서 필요한 것만 꺼낸다.
create table if not exists clause_chunks (
  id          text primary key,           -- 카드해시-섹션번호 (빌더가 생성)
  card_id     text not null,
  no          text,                       -- 특약번호 2-109 / 별표ID
  title       text not null,
  section     text not null,              -- 담보정의 / 보상범위 / 면책·감액 …
  cls         text,                       -- 담보분류
  content     text not null,
  chars       int generated always as (length(content)) stored
);
create index if not exists clause_chunks_no_idx      on clause_chunks (no);
create index if not exists clause_chunks_section_idx on clause_chunks (section);

-- ── 질문·답변 로그 ──
-- 자주 묻는 질문을 뽑고, 답이 빗나간 경우를 되짚어 검색을 손보기 위한 것.
create table if not exists chat_logs (
  id           bigserial primary key,
  session_id   text not null,
  turn         int  not null default 1,
  question     text not null,
  answer       text,
  cited        text[],                    -- 근거로 쓴 chunk id
  cards        text[],                    -- 모델이 고른 특약번호
  hint         jsonb,                     -- 규칙 검색이 넘긴 힌트(적중률 확인용)
  model        text,
  tokens_in    int,
  tokens_out   int,
  latency_ms   int,
  helpful      smallint,                  -- 1 좋아요 / -1 아니요 / null 미평가
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists chat_logs_created_idx on chat_logs (created_at desc);
create index if not exists chat_logs_session_idx on chat_logs (session_id, turn);

-- ── 같은 질문 재사용 ──
-- 질문을 정규화해 해시로 잡아 둔다. 상담에서 같은 질문이 반복되는 편이라
-- 캐시가 걸리면 응답이 즉시 나오고 호출 비용도 들지 않는다.
create table if not exists clause_cache (
  q_hash     text primary key,
  question   text not null,
  answer     text not null,
  cited      text[],
  hits       int not null default 1,
  created_at timestamptz not null default now(),
  used_at    timestamptz not null default now()
);

alter table clause_chunks enable row level security;
alter table chat_logs     enable row level security;
alter table clause_cache  enable row level security;

-- 본문은 누구나 읽을 수 있어도 되지만(공개 약관), 쓰기는 서비스 키로만.
drop policy if exists clause_chunks_read on clause_chunks;
create policy clause_chunks_read on clause_chunks for select using (true);

-- 로그·캐시는 브라우저에서 직접 만지지 못하게 한다. Edge Function(서비스 키)만 쓴다.
-- 정책을 하나도 두지 않으면 anon 키로는 아무것도 되지 않는다.
