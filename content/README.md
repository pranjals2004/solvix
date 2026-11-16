# Content imports

`templates/import.example.json` shows the JSON shape; replace its placeholder UUIDs with IDs from `/api/v1/subjects` and `/api/v1/subjects/:subjectId/topics`. `templates/questions.csv` and `templates/notes.csv` contain the supported CSV headers. JSON records use UUIDs; CSV records use the subject and topic slugs from those same endpoints. CSV JSON-valued cells (`optionsJson`, `correctAnswerJson`) must be quoted valid JSON.

An administrator imports either representation at `POST /api/v1/admin/import`. Each request accepts up to 100 questions and 100 notes; notes and worked solutions are chunked and embedded by the ML service before the database transaction starts. If embedding fails, the import is rejected and its content rows are not written. Supplying an existing UUID updates that record, making repeat imports possible.

For practice grading, store MCQ answers as an option label (`"A"`) or `{ "selected": "A" }`, MSQ answers as a list of labels, and NAT answers as a number or numeric string. The mobile client submits the learner's answer and required 1–5 confidence rating to `/api/v1/submissions`; the API returns the worked solution only after that attempt.

Run `npm run db:seed` after migrations and start the ML service first. It adds ten clearly labelled synthetic placeholder questions for each of the five core subjects. They exercise content paths only and must be replaced with reviewed, licensed material before student use. No performance or accuracy results are included.
