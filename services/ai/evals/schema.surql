-- The evals database: questions, runs and their cases (evals/store.py applies it on start).
DEFINE TABLE IF NOT EXISTS eval_question SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS suite ON eval_question TYPE string;
-- What a case asks and expects; its shape depends on the suite (see docs/evals.md).
DEFINE FIELD IF NOT EXISTS data ON eval_question TYPE object FLEXIBLE;
DEFINE FIELD IF NOT EXISTS active ON eval_question TYPE bool DEFAULT true;
DEFINE FIELD IF NOT EXISTS created_at ON eval_question TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON eval_question TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS eval_question_suite ON eval_question FIELDS suite;

DEFINE TABLE IF NOT EXISTS eval_run SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS suite ON eval_run TYPE string;
DEFINE FIELD IF NOT EXISTS status ON eval_run TYPE string DEFAULT 'running';
DEFINE FIELD IF NOT EXISTS version ON eval_run TYPE string;
DEFINE FIELD IF NOT EXISTS commit ON eval_run TYPE string;
DEFINE FIELD IF NOT EXISTS prompt ON eval_run TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS models ON eval_run TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS cost_usd ON eval_run TYPE float DEFAULT 0;
DEFINE FIELD IF NOT EXISTS passed ON eval_run TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total ON eval_run TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS planned ON eval_run TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS summary ON eval_run TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD IF NOT EXISTS error ON eval_run TYPE option<string>;
DEFINE FIELD IF NOT EXISTS started_at ON eval_run TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS finished_at ON eval_run TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_at ON eval_run TYPE datetime DEFAULT time::now() READONLY;
DEFINE FIELD IF NOT EXISTS updated_at ON eval_run TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX IF NOT EXISTS eval_run_suite ON eval_run FIELDS suite, started_at;

DEFINE TABLE IF NOT EXISTS eval_case SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS run ON eval_case TYPE record<eval_run>;
DEFINE FIELD IF NOT EXISTS question ON eval_case TYPE option<record<eval_question>>;
DEFINE FIELD IF NOT EXISTS input ON eval_case TYPE string;
DEFINE FIELD IF NOT EXISTS expected ON eval_case TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS output ON eval_case TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS passed ON eval_case TYPE bool;
DEFINE FIELD IF NOT EXISTS score ON eval_case TYPE option<float>;
DEFINE FIELD IF NOT EXISTS reason ON eval_case TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS models ON eval_case TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS cost_usd ON eval_case TYPE float DEFAULT 0;
-- Suite-specific details (the game, the judge's flags).
DEFINE FIELD IF NOT EXISTS extra ON eval_case TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at ON eval_case TYPE datetime DEFAULT time::now() READONLY;
DEFINE INDEX IF NOT EXISTS eval_case_run ON eval_case FIELDS run;
