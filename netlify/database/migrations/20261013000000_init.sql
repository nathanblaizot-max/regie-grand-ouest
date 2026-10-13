CREATE SEQUENCE IF NOT EXISTS docs_seq;

CREATE TABLE docs (
  tenant  text    NOT NULL DEFAULT 'main',
  col     text    NOT NULL,
  id      text    NOT NULL,
  data    jsonb   NOT NULL DEFAULT '{}'::jsonb,
  deleted boolean NOT NULL DEFAULT false,
  seq     bigint  NOT NULL DEFAULT nextval('docs_seq'),
  PRIMARY KEY (tenant, col, id)
);
CREATE INDEX docs_seq_idx ON docs (tenant, seq);

CREATE TABLE users (
  id         serial PRIMARY KEY,
  tenant     text    NOT NULL DEFAULT 'main',
  email      text    NOT NULL UNIQUE,
  name       text    NOT NULL DEFAULT '',
  pass_hash  text    NOT NULL,
  role       text    NOT NULL DEFAULT 'user',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meta (
  k text PRIMARY KEY,
  v text NOT NULL
);
