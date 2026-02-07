# Tailwind CSS v4 + pnpm + Ant Design 사용 규칙 (필독)

이 문서는 본 프로젝트의 **프론트엔드 스타일링 및 UI 설계의 단일 기준**입니다.  
대형 프로젝트 안정성과 유지보수를 위해 반드시 준수해야 합니다.

---

## 1. 핵심 원칙 (한 줄 요약)

> **Tailwind는 레이아웃만,  
> 디자인은 CSS 변수,  
> 복잡한 UI 기능은 Ant Design**

---

## 2. Tailwind CSS v4 사용 규칙

### ✅ 허용되는 사용 범위
- 레이아웃 및 배치
  - `flex`, `grid`, `gap-*`
  - `px-*`, `py-*`, `space-y-*`
  - `min-h-*`, `overflow-*`
  - `items-*`, `justify-*`

### ❌ 금지되는 사용
- 색상 / 의미 / 상태 표현
  - `bg-*`, `text-*`, `border-*`
- 디자인 시스템 정의
- utility 조합을 CSS 클래스로 추상화

#### ❌ 금지 예시
```tsx
className="bg-blue-500 text-white border-gray-200"
