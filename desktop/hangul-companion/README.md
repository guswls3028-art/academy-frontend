# Academy 한글 연결 프로그램 (Windows Beta)

도구 탭의 `한글에서 열기` 버튼이 발급한 5분짜리 1회성 연결 코드를 소비해 검수본 ZIP을 내려받고 SHA-256을 확인한 뒤, `03_자체양식_문제검수본.hwpx`를 한글로 전달합니다.

- 보이는 일반 편집 모드(`EditMode == 1`) 한글 문서가 있으면 현재 커서에 `InsertFile`을 시도합니다.
- 조건이 맞지 않거나 삽입이 거부되면 HWPX를 새 문서로 엽니다.
- 기존 문서를 저장·닫기·종료하지 않습니다.
- 다운로드 URL이나 인증 토큰을 custom URI에 직접 넣지 않습니다.
- handoff는 `https://api.hakwonplus.com/api/v1/tools/problem-studio/hangul-handoffs/`만 허용합니다.
- 결과 다운로드는 운영 API 또는 정확한 운영 R2 account host만 허용하며 userinfo, HTTP, 비표준 port, redirect는 거부합니다.
- 서버가 선언한 archive 크기는 0보다 크고 1 GiB 이하여야 합니다. Content-Length와 실제 stream도 선언 크기와 일치해야 하며 초과 stream은 디스크에 쓰기 전에 중단합니다.

## 빌드와 등록

```powershell
dotnet publish .\Academy.HangulCompanion.csproj -c Release -r win-x64 --self-contained false
.\install-protocol.ps1 -ExecutablePath .\bin\Release\net8.0-windows\win-x64\publish\Academy.HangulCompanion.exe
```

CI는 플랫폼 독립 trust-boundary 검사를 실행한 뒤 Windows companion을 Release로 빌드합니다.

등록 해제는 `uninstall-protocol.ps1`을 실행합니다. 연결 프로그램은 24시간이 지난 임시 다운로드 폴더를 다음 실행 때 정리합니다.

한컴 Automation의 파일 경로 보안 모듈을 승인·설치한 환경에서는 모듈 이름을 `ACADEMY_HWP_FILE_PATH_MODULE` 사용자 환경 변수로 지정합니다. 상용 배포 전에는 한컴의 Automation 사용 승인/재배포 조건, 보안 모듈 등록, 코드 서명을 별도로 완료해야 합니다. 승인 모듈이 없으면 한글 보안 정책에 따라 직접 삽입이 거부될 수 있으며 이때 새 HWPX 열기로 폴백합니다.
