# V3.5 patient sync fix

The app treats Supabase as the source of truth for patients. The UI now refreshes the patient list every 5 seconds while signed in. If a patient is deleted directly in Supabase, the patient disappears from the web app automatically; if the currently selected patient was deleted, the UI returns to Dashboard.

A manual refresh can also be triggered by reloading the page.
