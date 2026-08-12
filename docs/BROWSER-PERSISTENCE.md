# Browser persistence boundaries

브라우저 저장소는 서버 정본을 대체하지 않는다. 화면 복구와 반복 작업 편의를
위한 보조 상태만 보관하며, 저장소를 읽을 수 없거나 소유 범위를 확정할 수 없으면
해당 상태를 복원하지 않고 화면의 안전한 기본값으로 시작한다.

## Scope rules

| 상태 | 범위 | 예시 |
|---|---|---|
| 인증 세션 | 브라우저 | access/refresh token; 인증 모듈만 소유 |
| 제품과 무관한 표시 취향 | 브라우저 또는 계정 | 테마, 사이드바 접힘, 표 배율 |
| 학원별 공용 취향 | tenant | 공지 24시간 닫기, 강의 과목·클리닉 위치 제안 |
| 사용자 작성·복구 데이터 | tenant + user | 커뮤니티 글 초안, 영상 이어보기 |
| 실행 결과를 바꾸는 운영 취향 | tenant + user | 매치업 분할 방식, 자동 재분석 동의, 공개 게시 확인 생략 |

tenant 또는 user를 확인할 수 없는 상태에서 tenant+user 키를 만들거나 읽지
않는다. 소유 정보가 없던 기존 전역 초안은 다른 사용자에게 자동 귀속하지 않으며,
읽거나 삭제하지 않는다. 서버에 저장된 답안, 성적, 영상 진도, 보고서, 공개 상태가
항상 정본이다.

## Implementation ownership

`src/shared/utils/safeLocalStorage.ts`가 저장소 접근과 tenant/tenant+user 키 생성을
소유한다. 제품 화면은 원시 `localStorage.getItem/setItem/removeItem` 호출 대신
이 경계를 사용한다. 학생 영상의 현재 재생 항목과 7일 이어보기 보조값은
`src/app_student/domains/video/utils/videoPlaybackStorage.ts`가 추가로 소유하며
tenant, 로그인 사용자, 선택 enrollment 범위를 함께 넣는다.

저장소가 비활성, 가득 참, 손상된 경우에도 API 조회·입력·제출은 계속 동작한다.
만료되거나 파싱할 수 없는 보조값은 무시한다. 확인 생략이나 자동 실행 선호를 읽지
못하면 확인을 다시 표시하는 쪽으로 실패한다.

## Verification

```powershell
pnpm guard:test-coverage
pnpm refactor:budget
pnpm typecheck
pnpm exec playwright test e2e/refactor/landing-router.spec.ts --project=chromium
```

정적 계약은 사용자 작성 초안·매치업 운영 선호·학생 영상 화면이 원시 저장소
접근으로 되돌아가지 않는지 검사한다. 랜딩 E2E는 현재 tenant+user 초안만 복원하고
기존 전역 키, 다른 tenant 키, 다른 user 키를 읽거나 변경하지 않는지 검증한다.
