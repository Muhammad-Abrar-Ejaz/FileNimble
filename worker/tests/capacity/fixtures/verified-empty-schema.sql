--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversion_jobs (
    id uuid NOT NULL,
    owner_hash text NOT NULL,
    ip_hash text NOT NULL,
    capability text NOT NULL,
    state text NOT NULL,
    options jsonb NOT NULL,
    request_hash text NOT NULL,
    idempotency_key text NOT NULL,
    source_bytes bigint NOT NULL,
    output_bytes bigint,
    attempts integer DEFAULT 0 NOT NULL,
    run_id uuid,
    lease_until timestamp with time zone,
    dispatch_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    upload_expires_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    cleanup_after timestamp with time zone,
    purged_at timestamp with time zone,
    cleanup_failures integer DEFAULT 0 NOT NULL,
    worker_version text,
    CONSTRAINT conversion_jobs_source_bytes_check CHECK ((source_bytes > 0)),
    CONSTRAINT conversion_jobs_state_check CHECK ((state = ANY (ARRAY['CREATED'::text, 'UPLOADING'::text, 'VALIDATING'::text, 'QUEUED'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'EXPIRED'::text, 'FAILED'::text, 'CANCELLED'::text])))
);


--
-- Name: job_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_attempts (
    run_id uuid NOT NULL,
    job_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    outcome text,
    error_code text
);


--
-- Name: job_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_files (
    id uuid NOT NULL,
    job_id uuid NOT NULL,
    role text NOT NULL,
    object_key text NOT NULL,
    media_type text NOT NULL,
    bytes bigint DEFAULT 0 NOT NULL,
    checksum text,
    expires_at timestamp with time zone NOT NULL,
    purged_at timestamp with time zone,
    CONSTRAINT job_files_role_check CHECK ((role = ANY (ARRAY['upload'::text, 'input'::text, 'output'::text])))
);


--
-- Name: platform_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_counters (
    name text NOT NULL,
    value bigint DEFAULT 0 NOT NULL
);


--
-- Name: quota_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quota_windows (
    subject text NOT NULL,
    window_id bigint NOT NULL,
    requests integer DEFAULT 0 NOT NULL,
    bytes bigint DEFAULT 0 NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    hash text NOT NULL
);


--
-- Name: service_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_heartbeats (
    name text NOT NULL,
    seen_at timestamp with time zone NOT NULL
);


--
-- Name: conversion_jobs conversion_jobs_owner_hash_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_jobs
    ADD CONSTRAINT conversion_jobs_owner_hash_idempotency_key_key UNIQUE (owner_hash, idempotency_key);


--
-- Name: conversion_jobs conversion_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_jobs
    ADD CONSTRAINT conversion_jobs_pkey PRIMARY KEY (id);


--
-- Name: job_attempts job_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_attempts
    ADD CONSTRAINT job_attempts_pkey PRIMARY KEY (run_id);


--
-- Name: job_files job_files_job_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_job_id_role_key UNIQUE (job_id, role);


--
-- Name: job_files job_files_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_object_key_key UNIQUE (object_key);


--
-- Name: job_files job_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_pkey PRIMARY KEY (id);


--
-- Name: platform_counters platform_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_counters
    ADD CONSTRAINT platform_counters_pkey PRIMARY KEY (name);


--
-- Name: quota_windows quota_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota_windows
    ADD CONSTRAINT quota_windows_pkey PRIMARY KEY (subject, window_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: service_heartbeats service_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_heartbeats
    ADD CONSTRAINT service_heartbeats_pkey PRIMARY KEY (name);


--
-- Name: jobs_dispatch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_dispatch ON public.conversion_jobs USING btree (state, dispatch_at);


--
-- Name: jobs_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_expiry ON public.conversion_jobs USING btree (expires_at);


--
-- Name: job_attempts job_attempts_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_attempts
    ADD CONSTRAINT job_attempts_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.conversion_jobs(id);


--
-- Name: job_files job_files_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_files
    ADD CONSTRAINT job_files_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.conversion_jobs(id);


--
-- PostgreSQL database dump complete
--


