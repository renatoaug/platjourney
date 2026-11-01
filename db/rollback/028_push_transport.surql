-- Before rolling back to a server without transport filtering, stop the new app and
-- remove only APNs registrations. Keep Web Push rows, schema and transport DEFAULT:
-- old server writers omit transport and are still classified as webpush.
-- Returning to the new app re-registers opted-in iOS devices on launch/resume.
BEGIN TRANSACTION;
DELETE push_subscription WHERE transport = 'apns';
COMMIT TRANSACTION;
