# Academy 한글 연결 프로그램 (Windows)

도구 탭의 `한글에서 열기`가 발급한 5분짜리 1회성 연결 코드를 소비해 검수본 ZIP을 내려받고, 서버가 제공한 크기와 SHA-256을 확인한 뒤 `03_자체양식_문제검수본.hwpx`를 한글로 전달합니다.

## 사용자 설치

1. 도구 탭에서 `Windows 연결 프로그램 설치`를 눌러 ZIP을 내려받습니다.
2. ZIP을 모두 푼 뒤 `Academy.HangulCompanion.exe`를 두 번 누릅니다.
3. 설치 완료 안내가 나오면 도구 탭으로 돌아갑니다. 관리자 권한은 필요하지 않습니다.
4. AI 타이핑 완료 후 `한글에서 열기`를 누릅니다.

실행 파일은 `%LOCALAPPDATA%\Academy\HangulCompanion`에 복사되고 현재 Windows 사용자에게 `academy-hangul://` 연결 프로그램으로 등록됩니다. 제거할 때는 설치된 실행 파일을 `--uninstall` 인수와 함께 실행합니다.

- 보이는 일반 편집 모드(`EditMode == 1`) 한글 문서가 있으면 현재 커서에 `InsertFile`을 시도합니다.
- 조건이 맞지 않거나 삽입이 거부되면 HWPX를 새 문서로 엽니다.
- 기존 문서를 저장·닫기·종료하지 않습니다.
- 다운로드 URL이나 인증 토큰을 custom URI에 직접 넣지 않으며, handoff는 `api.hakwonplus.com` HTTPS만 허용합니다.
- 다운로드는 768MB로 제한되고, HWPX는 정확히 한 개만 허용하며 50MB를 넘으면 중단합니다.

## 빌드와 진단

```powershell
.\publish.ps1 -DotNetPath dotnet -OutputDirectory .\dist
Academy.HangulCompanion.exe --diagnose-handoff "academy-hangul://insert?handoff=..." ".\diagnostic.json"
dotnet run --project ..\hangul-companion-integration-tests\Academy.HangulCompanion.IntegrationTests.csproj -c Release
```

`--diagnose-handoff`는 한글을 열지 않고 실제 일회용 코드 소비, HTTPS ZIP 다운로드, 크기/SHA-256 검증, HWPX 추출 결과를 JSON으로 남깁니다.
Windows COM 통합 검사는 한글 Automation의 Running Object Table 계약을 재현해 보이는 일반 편집 문서 선택, `InsertFile` 파라미터, 보안 모듈 등록, 삽입 거부 폴백, 저장·닫기·종료 금지를 실행 검증합니다.
배포 자동화는 동일 설치/제거 로직의 메시지 없는 `--install-silent`, `--uninstall-silent`를 사용할 수 있습니다.

한컴 Automation의 파일 경로 보안 모듈을 승인·설치한 환경에서는 모듈 이름을 `ACADEMY_HWP_FILE_PATH_MODULE` 사용자 환경 변수로 지정합니다. 외부 상용 배포 전에는 한컴의 Automation 사용 승인/재배포 조건, 보안 모듈 등록, 코드 서명을 별도로 완료해야 합니다. 승인 모듈이 없으면 한글 보안 정책에 따라 직접 삽입이 거부될 수 있으며 이때 새 HWPX 열기로 폴백합니다.
