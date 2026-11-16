-- Android devices: Firebase Cloud Messaging joins APNs as a native transport. An FCM row has the
-- same installation, token and session_hash as an APNs row, and no environment (FCM has a single
-- endpoint). Web Push rows are untouched.
BEGIN TRANSACTION;
DEFINE FIELD OVERWRITE transport ON push_subscription TYPE string DEFAULT 'webpush' ASSERT IF $value = 'webpush' THEN $this.endpoint != NONE AND $this.p256dh != NONE AND $this.auth != NONE AND $this.installation = NONE AND $this.token = NONE AND $this.environment = NONE AND $this.session_hash = NONE ELSE IF $value = 'apns' THEN $this.installation != NONE AND $this.token != NONE AND $this.environment IN ['sandbox', 'production'] AND $this.session_hash != NONE AND $this.endpoint = NONE AND $this.p256dh = NONE AND $this.auth = NONE ELSE $value = 'fcm' AND $this.installation != NONE AND $this.token != NONE AND $this.environment = NONE AND $this.session_hash != NONE AND $this.endpoint = NONE AND $this.p256dh = NONE AND $this.auth = NONE END;
DEFINE FIELD OVERWRITE installation ON push_subscription TYPE option<string> ASSERT IF $this.transport IN ['apns', 'fcm'] THEN $value != NONE AND string::len($value) = 64 ELSE $value = NONE END;
DEFINE FIELD OVERWRITE token ON push_subscription TYPE option<string> ASSERT IF $this.transport = 'apns' THEN $value != NONE AND string::len($value) >= 32 AND string::len($value) <= 512 ELSE IF $this.transport = 'fcm' THEN $value != NONE AND string::len($value) >= 32 AND string::len($value) <= 4096 ELSE $value = NONE END;
DEFINE FIELD OVERWRITE session_hash ON push_subscription TYPE option<string> ASSERT IF $this.transport IN ['apns', 'fcm'] THEN $value != NONE AND string::len($value) > 0 ELSE $value = NONE END;
DEFINE FIELD OVERWRITE destination_key ON push_subscription TYPE string VALUE IF $this.transport = NONE OR $this.transport = 'webpush' THEN $this.endpoint ELSE IF $this.transport = 'fcm' THEN 'fcm:' + $this.token ELSE $this.environment + ':' + $this.token END;
COMMIT TRANSACTION;
