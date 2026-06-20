-- Compass RPC functions. Run after schema.sql + seed.sql.

create or replace function match_lessons(
  query_embedding vector(1536),
  match_count int default 3
) returns table (
  id uuid,
  title text,
  topic text,
  body text,
  cpd_hours numeric,
  similarity float
) language sql stable as $$
  select id, title, topic, body, cpd_hours,
         1 - (embedding <=> query_embedding) as similarity
  from learning_content
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_interactions(
  client uuid,
  query_embedding vector(1536),
  match_count int default 5
) returns table (
  id uuid,
  summary text,
  relational jsonb,
  similarity float
) language sql stable as $$
  select id, summary, relational,
         1 - (embedding <=> query_embedding) as similarity
  from interactions
  where client_id = client and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
