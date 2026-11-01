-- Upgrade existing Web Push rows in place; old web clients can still write flat fields.
-- DEFAULT classifies Web Push writers that omit the transport discriminator.
BEGIN TRANSACTION;
DEFINE FIELD OVERWRITE transport ON push_subscription TYPE string DEFAULT 'webpush' ASSERT IF $value = 'webpush' THEN $this.endpoint != NONE AND $this.p256dh != NONE AND $this.auth != NONE AND $this.installation = NONE AND $this.token = NONE AND $this.environment = NONE AND $this.session_hash = NONE ELSE $value = 'apns' AND $this.installation != NONE AND $this.token != NONE AND $this.environment IN ['sandbox', 'production'] AND $this.session_hash != NONE AND $this.endpoint = NONE AND $this.p256dh = NONE AND $this.auth = NONE END;
UPDATE push_subscription SET transport = 'webpush' WHERE transport = NONE;
DEFINE FIELD OVERWRITE endpoint ON push_subscription TYPE option<string> ASSERT IF $this.transport = NONE OR $this.transport = 'webpush' THEN $value != NONE ELSE $value = NONE END;
DEFINE FIELD OVERWRITE p256dh ON push_subscription TYPE option<string> ASSERT IF $this.transport = NONE OR $this.transport = 'webpush' THEN $value != NONE ELSE $value = NONE END;
DEFINE FIELD OVERWRITE auth ON push_subscription TYPE option<string> ASSERT IF $this.transport = NONE OR $this.transport = 'webpush' THEN $value != NONE ELSE $value = NONE END;
DEFINE FIELD OVERWRITE installation ON push_subscription TYPE option<string> ASSERT IF $this.transport = 'apns' THEN $value != NONE AND string::len($value) = 64 ELSE $value = NONE END;
DEFINE FIELD OVERWRITE token ON push_subscription TYPE option<string> ASSERT IF $this.transport = 'apns' THEN $value != NONE AND string::len($value) >= 32 AND string::len($value) <= 512 ELSE $value = NONE END;
DEFINE FIELD OVERWRITE environment ON push_subscription TYPE option<string> ASSERT IF $this.transport = 'apns' THEN $value IN ['sandbox', 'production'] ELSE $value = NONE END;
DEFINE FIELD OVERWRITE session_hash ON push_subscription TYPE option<string> ASSERT IF $this.transport = 'apns' THEN $value != NONE AND string::len($value) > 0 ELSE $value = NONE END;
-- Every indexed identity is populated for every row. Optional compound index fields
-- can omit rows and lead to incomplete prefix scans in SurrealDB 3.0.5.
-- Retain the legacy endpoint-only index for old Web Push UPSERT writers.
-- Only webpush rows can have an endpoint; APNs rows omit it.
DEFINE FIELD OVERWRITE destination_key ON push_subscription TYPE string VALUE IF $this.transport = NONE OR $this.transport = 'webpush' THEN $this.endpoint ELSE $this.environment + ':' + $this.token END;
DEFINE FIELD OVERWRITE registration_key ON push_subscription TYPE string VALUE IF $this.transport = NONE OR $this.transport = 'webpush' THEN $this.endpoint ELSE $this.installation END;
UPDATE push_subscription SET destination_key = destination_key WHERE destination_key = NONE OR registration_key = NONE;
DEFINE INDEX OVERWRITE push_subscription_destination ON push_subscription FIELDS transport, destination_key UNIQUE;
DEFINE INDEX OVERWRITE push_subscription_registration ON push_subscription FIELDS transport, registration_key UNIQUE;
COMMIT TRANSACTION;
