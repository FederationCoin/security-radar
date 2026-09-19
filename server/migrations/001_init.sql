-- Table-per-type radar schema. No FK on peers. Association tables have exactly two key columns.
CREATE TABLE IF NOT EXISTS scan_context (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS github_repository (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_github_repository (owner, name)
);

CREATE TABLE IF NOT EXISTS upstream_peer (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mainline VARCHAR(512) NOT NULL
);

CREATE TABLE IF NOT EXISTS maintainer (
  id CHAR(36) NOT NULL PRIMARY KEY,
  p2wpkh VARCHAR(90) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bip (
  id CHAR(36) NOT NULL PRIMARY KEY,
  number INT NOT NULL UNIQUE,
  title VARCHAR(512) NOT NULL,
  summary TEXT NOT NULL,
  what_it_does TEXT NULL,
  how_it_hits_us TEXT NULL,
  honor_notes TEXT NULL,
  ethos_notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS task (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(512) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  event_id CHAR(36) NULL
);

CREATE TABLE IF NOT EXISTS subscribed_feed_source (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ack_cadence VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS polled_feed_source (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ack_cadence VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS human_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bedrock_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL,
  model_id VARCHAR(128) NULL
);

CREATE TABLE IF NOT EXISTS cursor_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL,
  run_id VARCHAR(128) NULL
);

CREATE TABLE IF NOT EXISTS no_fork_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS soft_fork_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hard_fork_assessment (
  id CHAR(36) NOT NULL PRIMARY KEY,
  writeup TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quantum_clock (
  id CHAR(36) NOT NULL PRIMARY KEY,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quantum_milestone (
  id CHAR(36) NOT NULL PRIMARY KEY,
  at_label VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS hourly_scan_run (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS merge_ingest_run (
  id CHAR(36) NOT NULL PRIMARY KEY,
  scan_context_id CHAR(36) NOT NULL,
  github_run_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS threat_kind (
  id VARCHAR(64) NOT NULL PRIMARY KEY
);

INSERT IGNORE INTO threat_kind (id) VALUES ('EndUserThreat'), ('HostedInfraThreat'), ('ChainForkThreat');

CREATE TABLE IF NOT EXISTS missing_scan_context_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  github_owner_name VARCHAR(255) NOT NULL,
  github_repository_id CHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS missing_org_repo_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  scan_context_id CHAR(36) NOT NULL,
  missing_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS missing_dep_scan_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  scan_context_id CHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS dependency_vuln_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  scan_context_id CHAR(36) NOT NULL,
  package_identity VARCHAR(255) NOT NULL,
  vuln_key VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS upstream_mainline_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  scan_context_id CHAR(36) NOT NULL,
  upstream_id CHAR(36) NOT NULL,
  commit_sha VARCHAR(64) NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bip_arrived_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  bip_id CHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS stale_upstream_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  upstream_id CHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS distant_feed_event (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  feed_source_id VARCHAR(64) NOT NULL,
  source_native_id VARCHAR(512) NOT NULL,
  title VARCHAR(512) NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_tracks_repo (
  scan_context_id CHAR(36) NOT NULL,
  github_repository_id CHAR(36) NOT NULL,
  PRIMARY KEY (scan_context_id, github_repository_id)
);

CREATE TABLE IF NOT EXISTS context_follows_upstream (
  scan_context_id CHAR(36) NOT NULL,
  upstream_id CHAR(36) NOT NULL,
  PRIMARY KEY (scan_context_id, upstream_id)
);

CREATE TABLE IF NOT EXISTS upstream_follows (
  child_upstream_id CHAR(36) NOT NULL,
  parent_upstream_id CHAR(36) NOT NULL,
  PRIMARY KEY (child_upstream_id, parent_upstream_id)
);

CREATE TABLE IF NOT EXISTS upstream_observed (
  upstream_id CHAR(36) NOT NULL,
  hourly_scan_run_id CHAR(36) NOT NULL,
  tip VARCHAR(64) NOT NULL,
  dep_churn INT NOT NULL,
  public_maintainer_count INT NOT NULL,
  PRIMARY KEY (upstream_id, hourly_scan_run_id)
);

CREATE TABLE IF NOT EXISTS repo_observed (
  github_repository_id CHAR(36) NOT NULL,
  hourly_scan_run_id CHAR(36) NOT NULL,
  default_branch VARCHAR(128) NOT NULL,
  is_private TINYINT NOT NULL,
  PRIMARY KEY (github_repository_id, hourly_scan_run_id)
);

CREATE TABLE IF NOT EXISTS clock_has_milestone (
  quantum_clock_id CHAR(36) NOT NULL,
  quantum_milestone_id CHAR(36) NOT NULL,
  PRIMARY KEY (quantum_clock_id, quantum_milestone_id)
);

CREATE TABLE IF NOT EXISTS task_for_event (
  task_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  PRIMARY KEY (task_id, event_id)
);

CREATE TABLE IF NOT EXISTS maintainer_takes_task (
  maintainer_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  accepted_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (maintainer_id, task_id)
);

CREATE TABLE IF NOT EXISTS maintainer_reviews_bip (
  maintainer_id CHAR(36) NOT NULL,
  bip_id CHAR(36) NOT NULL,
  notes TEXT NOT NULL,
  reviewed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (maintainer_id, bip_id)
);

CREATE TABLE IF NOT EXISTS maintainer_acks_event (
  maintainer_id CHAR(36) NOT NULL,
  distant_feed_event_id CHAR(36) NOT NULL,
  acked_at DATETIME(3) NOT NULL,
  PRIMARY KEY (maintainer_id, distant_feed_event_id)
);

CREATE TABLE IF NOT EXISTS event_related_bip (
  event_id CHAR(36) NOT NULL,
  bip_id CHAR(36) NOT NULL,
  PRIMARY KEY (event_id, bip_id)
);

CREATE TABLE IF NOT EXISTS event_in_bucket (
  event_id CHAR(36) NOT NULL,
  threat_kind_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (event_id, threat_kind_id)
);

CREATE TABLE IF NOT EXISTS event_has_assessment (
  event_id CHAR(36) NOT NULL,
  assessment_id CHAR(36) NOT NULL,
  PRIMARY KEY (event_id, assessment_id)
);

CREATE TABLE IF NOT EXISTS dep_vuln_observed (
  dependency_vuln_event_id CHAR(36) NOT NULL,
  merge_ingest_run_id CHAR(36) NOT NULL,
  project_version VARCHAR(128) NOT NULL,
  resolved_dep_version VARCHAR(128) NOT NULL,
  PRIMARY KEY (dependency_vuln_event_id, merge_ingest_run_id)
);

CREATE TABLE IF NOT EXISTS missing_context_observed (
  missing_scan_context_event_id CHAR(36) NOT NULL,
  hourly_scan_run_id CHAR(36) NOT NULL,
  PRIMARY KEY (missing_scan_context_event_id, hourly_scan_run_id)
);

CREATE TABLE IF NOT EXISTS missing_repo_observed (
  missing_org_repo_event_id CHAR(36) NOT NULL,
  hourly_scan_run_id CHAR(36) NOT NULL,
  PRIMARY KEY (missing_org_repo_event_id, hourly_scan_run_id)
);
