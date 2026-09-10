# Teacher operations assistant beta

Route: `/workspace/mobile/assistant`.

The teacher submits up to five images and one current request. Each image keeps an independent student identity; “이 친구도” may inherit only the previous operation intent. The client submits the previous signed proposal only for an explicitly referential request such as “이 친구도”; an independent new request never depends on an expired prior proposal. The review receipt shows existing/new evidence, profile-link changes, lecture/session, `Attendance=ONLINE`, Alimtalk targets, and correction impact before confirm.

When the preview identifies a new student account or a genuinely missing parent account, that row shows a required password field. The teacher must enter at least four characters before confirm. The client sends exactly that value only in the confirm request; it never derives or pre-fills a phone-number suffix, and healthy existing accounts do not show the field or have their password changed.

A student phone number is optional for a new account. When it is absent, the server issues a dedicated login ID and the completion receipt shows the exact saved ID so the teacher can verify what to communicate.

Completion separates account creation, existing-account linking, correct enrollment, ONLINE/proctored video access, Alimtalk provider acceptance, and the separate real-playback canary. Provider acceptance is never labeled as Kakao read. At 390px the form and receipts are single-column with no horizontal overflow; wider screens expand fields and evidence.
