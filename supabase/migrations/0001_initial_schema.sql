-- ---------------------------------------------------------------------------
-- MedGuard (Triage One) — initial schema
--
-- Stores every assessment the service handles, the prediction produced for
-- it, and the model versions that produced those predictions.
--
-- Access model
-- ------------
-- All reads and writes go through the FastAPI backend, which authenticates
-- with a server-side key. The tables therefore have Row Level Security
-- enabled with NO permissive policy for the ``anon`` or ``authenticated``
-- roles: a client holding only the publishable key cannot read or write
-- anything directly. Ownership is enforced by the backend, which scopes every
-- query to the caller's ``owner_token`` — a random identifier minted per
-- browser and sent in the ``X-MedGuard-Owner`` header.
--
-- The dataset is synthetic and contains no patient identifiers. The
-- ``inputs`` column holds the feature values the model was given.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- --- Assessments ----------------------------------------------------------
create table if not exists public.assessments (
    id                uuid primary key default gen_random_uuid(),
    created_at        timestamptz not null default now(),

    -- Opaque per-browser owner token. Enforces that a caller only ever sees
    -- their own history.
    owner_token       text        not null,

    -- Which interface submitted it.
    surface           text        not null default 'patient',

    -- The feature values the model was given.
    inputs            jsonb       not null default '{}'::jsonb,

    -- Feature names that were absent and therefore imputed.
    missing_inputs    text[]      not null default '{}',

    -- Which model produced the prediction.
    model_name        text,
    model_version     text,

    -- The prediction and its context.
    predicted_esi_level integer,
    probabilities     jsonb,
    explanation       jsonb,
    quality           jsonb,
    uncertainty       jsonb,

    -- Bookkeeping.
    input_warnings    integer     not null default 0,
    duration_ms       integer
);

create index if not exists assessments_owner_created_idx
    on public.assessments (owner_token, created_at desc);
create index if not exists assessments_created_idx
    on public.assessments (created_at desc);
create index if not exists assessments_esi_idx
    on public.assessments (predicted_esi_level)
    where predicted_esi_level is not null;

-- --- Predictions ---------------------------------------------------------
-- One prediction per assessment. Kept separate so the assessment history
-- can be queried without carrying the (larger) explanation payload.
create table if not exists public.predictions (
    id                uuid primary key default gen_random_uuid(),
    created_at        timestamptz not null default now(),

    assessment_id     uuid        not null
        references public.assessments (id) on delete cascade,

    model_name        text        not null,
    model_version     text,
    predicted_esi_level integer   not null,
    probabilities     jsonb       not null,
    explanation       jsonb,
    quality           jsonb,
    uncertainty       jsonb
);

create unique index if not exists predictions_assessment_idx
    on public.predictions (assessment_id);

-- --- Model registry ------------------------------------------------------
-- Every model version the service has served, so a stored prediction can
-- always be traced to the artifact that produced it.
create table if not exists public.model_registry (
    id                uuid primary key default gen_random_uuid(),
    created_at        timestamptz not null default now(),

    version           text        not null,
    model_name        text        not null,
    dataset           text        not null,
    target            text        not null,
    esi_labels        integer[]   not null,
    training_rows     integer,
    training_patients integer,
    class_distribution jsonb      not null default '{}'::jsonb,
    artifact_sha256   text,
    params            jsonb       not null default '{}'::jsonb,
    versions          jsonb       not null default '{}'::jsonb,
    trained_at        timestamptz,
    note              text,
    is_active         boolean     not null default false
);

create unique index if not exists model_registry_version_idx
    on public.model_registry (version);

-- --- Row Level Security --------------------------------------------------
-- RLS is enabled and no policy grants access to the browser roles. The
-- backend is the only writer and the only reader, and it scopes every query
-- to the caller's owner token.
alter table public.assessments   enable row level security;
alter table public.predictions   enable row level security;
alter table public.model_registry enable row level security;

-- Force RLS so that even a table owner is subject to the policies.
alter table public.assessments   force row level security;
alter table public.predictions   force row level security;
alter table public.model_registry force row level security;

-- No permissive policies are created for `anon` or `authenticated` on
-- purpose: direct client access is denied and all access is mediated by the
-- FastAPI backend, which applies the ownership check.
drop policy if exists "assessments owner read" on public.assessments;
drop policy if exists "predictions owner read" on public.predictions;
drop policy if exists "model registry read" on public.model_registry;
