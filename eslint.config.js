import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      '.wrangler/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'e2e/.auth/**',
      'e2e/_artifacts/**',
      'e2e/_local/**',
      'e2e/screenshots/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Badge SSOT 가드 — 신규 코드는 반드시 <Badge>(@/shared/ui/ds) 사용.
      // raw <span className="ds-badge ..."> / <span className="ds-status-badge ..."> 신규 도입 차단.
      // pnpm lint의 --max-warnings 0이 아래 경고도 전체 저장소에서 차단한다.
      // 인라인 style={{...}} 객체 리터럴을 검사한다.
      // 동적 스타일(`style={someVar}`/`style={...spread}`)은 통과 — 명시적 inline 객체만 차단.
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "JSXOpeningElement[name.name='span'] > JSXAttribute[name.name='className'][value.type='Literal'][value.value=/\\bds-(status-)?badge\\b/]",
          message:
            'raw <span className="ds-badge|ds-status-badge"> 금지. <Badge> from "@/shared/ui/ds" 를 사용하세요.',
        },
        {
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression",
          message:
            "인라인 style={{...}} 신규 도입 금지. CSS 모듈 / DS token / className 사용. 정말 동적 계산이 필요하면 해당 줄에 // eslint-disable-next-line no-restricted-syntax 추가.",
        },
      ],
    },
  },
  // E2E 전용 규칙: waitForTimeout 안티패턴 경고.
  // 새 spec 작성 시 helpers/wait.ts (gotoAndSettle/clickAndExpect/waitForCondition) 사용 유도.
  // 이 경고도 pnpm lint의 --max-warnings 0 기준으로 차단한다.
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'page.waitForTimeout(N) 은 안티패턴. helpers/wait.ts 의 gotoAndSettle / clickAndExpect / waitForCondition 사용. 정말 필요하면 해당 줄에 // eslint-disable-next-line no-restricted-syntax 추가.',
        },
      ],
    },
  },
)
