# 0033. Catalog images as static files of the frontend

Status: Accepted

## Context

The official catalog PDF embeds 26 raster images: light and shape configurations for the KVR questions, two weather maps, mooring sketches, a sailing manoeuvre and a wind-vector diagram. Without them some questions can't be answered (Schifffahrtsrecht 23 reads "ändert sich plötzlich von in" — both diagrams are missing) and three official answers are *only* a sketch (Seemannschaft I 79/104, II 65), so their `answer_text` is empty. `questions.image_ref` existed for this but was never filled, and it could hold only one image per question, while questions carry up to two and answers up to two more.

Options for where the files live: object storage (Cloudflare R2, the earlier "TBD"), the backend, or the frontend's own static files.

## Decision

- `backend/scripts/extract_catalog_images.py` (dev tooling, PyMuPDF from `requirements-dev.txt`) reads the PDF, writes each image as a PNG to `frontend/public/catalog/` and *proposes* `backend/scripts/data/question_images.yaml`: one entry per image with its raw PDF key, part (`question`/`answer`) and pixel size. A human corrects the proposal and commits both — the same "propose by script, review by hand, commit" pattern as the Seemannschaft merge and the topic assignments. The catalog's Schallsignal icons (a dash and dots, three tiny images) are left out: the text already spells the signal out.
- `catalog_seed.attach_images()` applies the reviewed file before the Seemannschaft merge and fails loudly on an unknown question, a bad part or a missing file. `questions` gets two JSON columns, `question_images` and `answer_images` (lists of `{src, width, height}`), replacing `image_ref`. The migration adds them and re-syncs the catalog, so they arrive together. `sync_catalog` writes them only when the columns exist, because the older data migrations run against the schema of their own revision.
- The API returns file names; `/catalog/<src>` is served by the frontend's static site (`img-src 'self'` already covers it). The exam payload carries the question images from the start and the answer images only once the exam is submitted, like `official_answer` (ADR-0029).
- The frontend's `QuestionImages` shows them below the question text and inside "Amtliche Antwort", small ones at twice their pixel size, large ones (200 px and wider) at natural size (the catalog's images are ~72 dpi line art), on a white background in dark mode, with width/height set so the layout doesn't jump.

## Consequences

- No new infrastructure, no signed URLs, no CORS: 23 files, ~390 KB, deployed with the frontend and cached by the CDN. Adding an image is a commit, not an upload.
- Images sit *after* the whole question text, not where the PDF had them (Schifffahrtsrecht 21 has its diagram between the intro line and the numbered sub-questions; 23 has "von [Bild] in [Bild]"). Reproducing the position would need the parse to emit markers into the text; not worth it for 12 questions.
- A merged Seemannschaft pair carries the Seemannschaft I images, like its wording (ADR-0026): for the two mooring sketches (I 78/79 = II 64/65) Motor learners see the sailing boat, not the motor boat the Motor catalog draws. The task is identical; if it ever matters, un-merging those pairs is the ADR-0026 mechanism.
- The alt texts are generic ("Abbildung zur Frage"); the diagrams have no textual description a screen reader could use.
- The AI answer check still only sees text ([ADR-0031](0031-ai-answer-check-with-claude-haiku.md)), so for image questions it can't judge what the learner would have to read off the picture.
- A changed source PDF needs `extract_catalog_images.py --force` and a new review.
