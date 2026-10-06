# Synthetic report reader fixtures

These files were created for automated tests; they contain no tenant documents,
accounts, student information or customer data.

- `public-resource-report.hwpx`: python-hwpx builds a Korean heading, two explanatory
  paragraphs, a 3×3 table with QA units/counts/percentages and a Pillow-generated
  two-bar diagram. Values such as 12/85% and 8/75% are invented test data.
- `public-resource-equation.hwp`: Academy's `build_hwpx_text_document` creates
  `QA 수식 분석 보고서`, `물 분자는 H₂O입니다.` and
  `농도 비는 [[수식:{x+1} over {2}]]입니다.`. The official MIT-licensed
  rhwp v0.8.7 CLI converts this synthetic HWPX to HWP with
  `rhwp convert input.hwpx output.hwp --verify --json` (roundtrip diff count zero).

The application does not ship the generation inputs as customer examples. Tests
read the fixtures byte-for-byte, upload only into disposable isolated QA tenants,
verify actual native conversion and decoded images/formulas, then clean up the
exact created tenant rows and original/derived object prefixes. The native renderer
version/checksums and runtime safety contract belong to academy-backend
`docs/domain/public-resource-board.md` and `scripts/install-resource-reader.py`.
