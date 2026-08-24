# Teacher operations assistant beta

Route: `/workspace/mobile/assistant`.

The teacher submits up to five images and one current request. Each image keeps an independent student identity; “이 친구도” may inherit only the previous operation intent. The client submits the previous signed proposal only for an explicitly referential request such as “이 친구도”; an independent new request never depends on an expired prior proposal. The review receipt shows existing/new evidence, profile-link changes, lecture/session, `Attendance=ONLINE`, Alimtalk targets, and correction impact before confirm.

Completion separates account creation, existing-account linking, correct enrollment, ONLINE/proctored video access, Alimtalk provider acceptance, and the separate real-playback canary. Provider acceptance is never labeled as Kakao read. At 390px the form and receipts are single-column with no horizontal overflow; wider screens expand fields and evidence.
