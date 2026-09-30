# 학생앱 테넌트 테마

- `brand.css`: 모든 `[data-student-theme]`에 적용되는 공통 규칙(배경 워시, 상단바·탭바,
  패널, 활성 탭, primary 버튼, 아이콘 그라데이션, 포커스). 선택자는 여기서만 관리한다.
- `{theme}.css`: 테넌트 토큰만 정의한다(라이트 블록 + 다크 블록).
- `index.css`: `brand.css`를 먼저, 테넌트 파일을 뒤에 import한다.

토큰 의미·대비 기준·추가 절차는 상위 [`../README.md`](../README.md)를 따른다.
