// PATH: src/features/legal/pages/PrivacyPage.tsx
// 개인정보 처리방침 — Korean Privacy Policy
// 법적 근거: 개인정보 보호법 제30조, 시행령 제31조, PIPC 작성지침 2025.4

import { Link } from "react-router-dom";
import styles from "./LegalPage.module.css";

export default function PrivacyPage() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link to="/login" className={styles.backLink}>
          &#8592; 돌아가기
        </Link>
        <h1 className={styles.headerTitle}>개인정보 처리방침</h1>
      </header>

      <div className={styles.container}>
        <h1 className={styles.title}>개인정보 처리방침</h1>
        <p className={styles.meta}>
          시행일: 2026년 3월 14일 | 버전 1.1
        </p>

        <article className={styles.article}>
          <p>
            <span className={styles.placeholder}>[TODO_FOR_OWNER: 상호]</span>(이하 "회사")는 개인정보 보호법 등
            관련 법령에 따라 정보주체의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리하기 위하여
            다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          {/* ── 1. 처리 목적 ── */}
          <h2>제1조 (개인정보의 처리 목적)</h2>
          <p>회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p>
          <ol>
            <li><strong>서비스 제공 및 운영:</strong> 학생 관리, 출결·성적·시험 관리, 수업 영상 제공, 과제 관리, 메시지 발송</li>
            <li><strong>회원 관리:</strong> 본인 확인, 서비스 이용 계약 이행, 계정 관리</li>
            <li><strong>커뮤니케이션:</strong> 공지사항 전달, 서비스 관련 안내, 학부모 연락 (SMS, 카카오 알림톡)</li>
            <li><strong>서비스 개선:</strong> 서비스 이용 통계 분석 (개별 식별 불가능한 집계 데이터)</li>
            <li><strong>스태프 관리:</strong> 근태 관리, 급여 정산</li>
            <li><strong>유료 서비스 운영:</strong> 구독 결제 처리, 환불, 이용 요금 정산</li>
          </ol>

          {/* ── 2. 처리 항목 ── */}
          <h2>제2조 (처리하는 개인정보의 항목)</h2>
          <table>
            <thead>
              <tr>
                <th>구분</th>
                <th>수집 항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>이용자 계정 (공통)</td>
                <td>이름, 전화번호, 이메일, 로그인 아이디 (username), 비밀번호 (암호화 저장)</td>
              </tr>
              <tr>
                <td>학생</td>
                <td>
                  이름, 성별, 학년, 휴대전화번호, 학부모 전화번호, 학교 정보 (학교명, 반, 계열, 출신중학교),
                  주소, 프로필 사진, OMR 코드, PS 번호, 메모
                </td>
              </tr>
              <tr>
                <td>학부모</td>
                <td>이름, 전화번호, 이메일, 메모</td>
              </tr>
              <tr>
                <td>스태프 (강사/직원)</td>
                <td>이름, 전화번호, 프로필 사진, 급여 유형 (시급/월급 등)</td>
              </tr>
              <tr>
                <td>서비스 이용 과정에서 자동 생성</td>
                <td>시험 성적, 출결 기록, 수업 영상 시청 기록 (시청 시간, 진도율), 메시지 발송 이력, 접속 로그</td>
              </tr>
            </tbody>
          </table>

          <h3>수집 방법</h3>
          <ul>
            <li>학원 운영자(원장) 또는 스태프가 서비스 내에서 직접 입력</li>
            <li>학생이 회원가입 신청 폼을 통해 직접 입력 (원장 승인 후 등록)</li>
            <li>서비스 이용 과정에서 자동 생성 (시험 성적, 출결 기록, 수업 영상 시청 기록, 메시지 발송 이력)</li>
          </ul>

          {/* ── 3. 만 14세 미만 아동 (PIPC 2025 필수) ── */}
          <h2>제3조 (만 14세 미만 아동의 개인정보 처리)</h2>
          <ol>
            <li>회사는 만 14세 미만 아동의 개인정보를 처리하는 경우, 개인정보 보호법 제22조의2에 따라
              <strong> 법정대리인(보호자)의 동의</strong>를 받습니다.</li>
            <li>학원 서비스의 특성상, 만 14세 미만 학생의 등록은 원칙적으로 원장 또는 스태프가 학부모(법정대리인)의
              동의를 직접 확인한 후 진행합니다.</li>
            <li>만 14세 미만 학생이 직접 회원가입을 신청하는 경우, 학부모 전화번호를 통해 법정대리인에게
              동의 확인을 요청합니다.</li>
            <li>법정대리인은 아동의 개인정보에 대하여 열람, 정정·삭제, 처리정지를 요구할 수 있으며,
              이러한 요구는 제8조에서 정한 방법으로 행사할 수 있습니다.</li>
          </ol>

          {/* ── 4. 보유 기간 ── */}
          <h2>제4조 (개인정보의 처리 및 보유 기간)</h2>
          <ol>
            <li>회사는 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</li>
            <li>보유 기간:
              <ul>
                <li><strong>서비스 이용 계약 존속 기간:</strong> 서비스 이용 계약이 유효한 기간 동안 보유</li>
                <li><strong>계약 해지 후:</strong> 소프트 삭제(soft-delete) 처리 후 30일 경과 시 완전 파기</li>
                <li><strong>수업 영상:</strong> 삭제 요청 후 소프트 삭제 처리, 180일 경과 후 스토리지에서 완전 제거</li>
              </ul>
            </li>
            <li>관련 법령에 의해 보존이 필요한 경우, 해당 법령이 정한 기간 동안 보유합니다:
              <table>
                <thead>
                  <tr>
                    <th>보존 근거</th>
                    <th>보존 항목</th>
                    <th>보존 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>전자상거래법 시행령 제6조</td>
                    <td>계약 또는 청약철회 기록</td>
                    <td>5년</td>
                  </tr>
                  <tr>
                    <td>전자상거래법 시행령 제6조</td>
                    <td>대금결제 및 재화등의 공급 기록</td>
                    <td>5년</td>
                  </tr>
                  <tr>
                    <td>전자상거래법 시행령 제6조</td>
                    <td>소비자 불만 또는 분쟁처리 기록</td>
                    <td>3년</td>
                  </tr>
                  <tr>
                    <td>전자상거래법 시행령 제6조</td>
                    <td>표시·광고에 관한 기록</td>
                    <td>6개월</td>
                  </tr>
                  <tr>
                    <td>통신비밀보호법</td>
                    <td>접속 로그 기록</td>
                    <td>3개월</td>
                  </tr>
                </tbody>
              </table>
            </li>
          </ol>

          {/* ── 5. 파기 ── */}
          <h2>제5조 (개인정보의 파기절차 및 파기방법)</h2>
          <ol>
            <li><strong>파기 절차:</strong> 수집 목적이 달성된 개인정보는 보유 기간 경과 후 지체 없이 파기합니다.
              법령에 의해 보존이 필요한 경우에는 해당 개인정보를 별도 분리하여 보관합니다.</li>
            <li><strong>파기 방법:</strong>
              <ul>
                <li>전자적 파일: 기록을 복구·재생할 수 없도록 데이터베이스에서 완전 삭제</li>
                <li>파일 스토리지(프로필 사진, 수업 영상 등): 클라우드 스토리지에서 오브젝트 삭제</li>
              </ul>
            </li>
          </ol>

          {/* ── 6. 제3자 제공 ── */}
          <h2>제6조 (개인정보의 제3자 제공)</h2>
          <p>
            회사는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며, 원칙적으로 정보주체의 사전 동의
            없이 제3자에게 개인정보를 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다:
          </p>
          <ol>
            <li>정보주체가 사전에 동의한 경우</li>
            <li>법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위해 불가피한 경우</li>
          </ol>

          {/* ── 7. 위탁 ── */}
          <h2>제7조 (개인정보 처리업무의 위탁)</h2>
          <p>
            회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
            위탁받는 자에게 관련 법령을 준수하도록 관리·감독하고 있습니다.
          </p>
          <table>
            <thead>
              <tr>
                <th>수탁업체</th>
                <th>위탁 업무</th>
                <th>보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Amazon Web Services, Inc.</td>
                <td>클라우드 인프라 운영 (EC2 서버, SQS 메시지 큐, ECR 컨테이너)</td>
                <td>위탁 계약 종료 시 또는 목적 달성 시</td>
              </tr>
              <tr>
                <td>Cloudflare, Inc.</td>
                <td>CDN, 정적 웹 호스팅 (Pages), 오브젝트 스토리지 (R2) — 수업 영상, 프로필 사진 등 파일 저장</td>
                <td>위탁 계약 종료 시 또는 목적 달성 시</td>
              </tr>
              <tr>
                <td>솔라피 (Solapi)</td>
                <td>SMS 및 카카오 알림톡 발송 (학부모 연락, 공지 전달)</td>
                <td>발송 완료 시 즉시 파기 (발송 로그만 보유)</td>
              </tr>
            </tbody>
          </table>

          {/* ── 8. 국외 이전 (PIPC 2025 필수 — Cloudflare CDN) ── */}
          <h2>제8조 (개인정보의 국외 이전)</h2>
          <p>
            회사는 서비스 제공을 위해 다음과 같이 개인정보를 국외의 사업자에게 처리를 위탁하고 있습니다
            (개인정보 보호법 제28조의8).
          </p>
          <table>
            <thead>
              <tr>
                <th>이전받는 자</th>
                <th>이전되는 국가</th>
                <th>이전 항목</th>
                <th>이전 목적</th>
                <th>보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Amazon Web Services, Inc.</td>
                <td>대한민국 (서울 리전)</td>
                <td>서비스 운영에 필요한 모든 개인정보</td>
                <td>클라우드 서버 운영 및 데이터 저장</td>
                <td>위탁 계약 종료 시까지</td>
              </tr>
              <tr>
                <td>Cloudflare, Inc.</td>
                <td>미국 (CDN 엣지 노드 경유)</td>
                <td>IP 주소, 접속 로그, 웹 요청 데이터, 수업 영상 파일</td>
                <td>CDN 서비스, 파일 스토리지 (R2), 웹 호스팅</td>
                <td>위탁 계약 종료 시까지</td>
              </tr>
            </tbody>
          </table>
          <p>
            AWS 서울 리전에 저장되는 데이터는 대한민국 내에서 처리됩니다. Cloudflare의 경우 CDN 특성상
            전 세계 엣지 노드를 통해 콘텐츠가 전송될 수 있으며, 이는 서비스 제공(계약 이행)에 필요한 범위 내의
            처리입니다.
          </p>

          {/* ── 9. 안전성 확보 조치 ── */}
          <h2>제9조 (개인정보의 안전성 확보조치)</h2>
          <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다 (개인정보 보호법 제29조, 시행령 제30조):</p>
          <ol>
            <li><strong>관리적 조치:</strong> 개인정보 보호 내부 관리 계획 수립·시행, 접근 권한 관리, 취급 직원 최소화</li>
            <li><strong>기술적 조치:</strong>
              <ul>
                <li>비밀번호 암호화 저장 (단방향 해시 알고리즘)</li>
                <li>통신 구간 암호화 (HTTPS/TLS)</li>
                <li>JWT 기반 인증 (쿠키 미사용, 세션 서버 미사용)</li>
                <li>테넌트(학원) 단위 데이터 논리적 격리</li>
                <li>데이터베이스 접근 제어 및 접속 로그 관리</li>
                <li>악성프로그램 방지를 위한 보안 조치</li>
              </ul>
            </li>
            <li><strong>물리적 조치:</strong> 클라우드 인프라 사업자(AWS)의 물리적 보안 정책에 따름</li>
          </ol>

          {/* ── 10. 자동 수집 장치 (PIPC 2025 별도 조항) ── */}
          <h2>제10조 (개인정보 자동 수집 장치의 설치·운영 및 거부)</h2>
          <p>
            본 서비스는 <strong>쿠키(Cookie)를 사용하지 않습니다.</strong> 인증은 JWT(JSON Web Token) 방식으로
            처리하며, 쿠키를 통한 이용자 추적이나 정보 수집을 하지 않습니다.
          </p>
          <p>
            본 서비스는 <strong>별도의 웹 분석·추적 도구</strong>(Google Analytics, Facebook Pixel 등)를
            사용하지 않으며, 제3자의 행태정보 수집을 허용하지 않습니다.
          </p>

          {/* ── 11. 정보주체 권리 ── */}
          <h2>제11조 (정보주체와 법정대리인의 권리·의무 및 행사방법)</h2>
          <ol>
            <li>정보주체는 회사에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다 (개인정보 보호법 제35조~제38조):
              <ol>
                <li>개인정보 <strong>열람</strong> 요구 (제35조)</li>
                <li>오류 등이 있을 경우 <strong>정정</strong> 요구 (제36조)</li>
                <li><strong>삭제</strong> 요구 (제36조)</li>
                <li><strong>처리정지</strong> 요구 (제37조)</li>
                <li><strong>동의 철회</strong> (제37조)</li>
              </ol>
            </li>
            <li><strong>만 14세 미만 아동</strong>의 법정대리인은 해당 아동의 개인정보에 대하여 위 권리를 대리하여 행사할 수 있습니다.</li>
            <li>학생·학부모의 경우 해당 학원의 원장을 통해 권리를 행사하거나, 회사 고객센터에 직접 요청할 수
              있습니다.</li>
            <li>권리 행사는 서면, 전화, 이메일 등을 통해 가능하며, 회사는 지체 없이 조치합니다.</li>
            <li>정보주체가 개인정보의 오류에 대한 정정을 요구한 경우, 정정이 완료되기 전까지 해당 개인정보를
              이용하거나 제공하지 않습니다.</li>
            <li>삭제 요구 시 해당 개인정보를 복구·재생할 수 없도록 조치합니다. 다만, 다른 법령에서 해당 개인정보의
              수집을 의무화한 경우에는 삭제를 요구할 수 없습니다.</li>
            <li>권리 행사에 대한 처리 결과에 이의가 있는 경우, 회사에 이의를 제기할 수 있으며, 회사는 이의 제기
              절차를 마련하여 안내합니다.</li>
          </ol>

          {/* ── 12. 개인정보 보호책임자 및 고충처리 ── */}
          <h2>제12조 (개인정보 보호책임자 및 고충처리 부서)</h2>
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 정보주체의 불만 처리 및 피해 구제를 위하여
            아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
          </p>
          <h3>개인정보 보호책임자</h3>
          <ul>
            <li>성명: <span className={styles.placeholder}>[TODO_FOR_OWNER: 개인정보 보호책임자 성명]</span></li>
            <li>직위: <span className={styles.placeholder}>[TODO_FOR_OWNER: 직위]</span></li>
            <li>연락처: <span className={styles.placeholder}>[TODO_FOR_OWNER: 전화번호]</span></li>
            <li>이메일: <span className={styles.placeholder}>[TODO_FOR_OWNER: 이메일]</span></li>
          </ul>
          <h3>고충처리 부서</h3>
          <ul>
            <li>부서명: <span className={styles.placeholder}>[TODO_FOR_OWNER: 고충처리 부서명 (예: 고객지원팀)]</span></li>
            <li>연락처: <span className={styles.placeholder}>[TODO_FOR_OWNER: 고충처리 전화번호]</span></li>
            <li>이메일: <span className={styles.placeholder}>[TODO_FOR_OWNER: 고충처리 이메일]</span></li>
          </ul>
          <p>
            정보주체는 서비스 이용 중 발생한 모든 개인정보 보호 관련 문의, 불만, 피해 구제 등에 관한 사항을
            개인정보 보호책임자 또는 고충처리 부서에 문의할 수 있습니다.
          </p>

          {/* ── 13. 권익침해 구제방법 ── */}
          <h2>제13조 (권익침해 구제방법)</h2>
          <p>
            개인정보 침해에 대한 신고·상담이 필요한 경우 다음 기관에 문의할 수 있습니다:
          </p>
          <ul>
            <li>개인정보 침해신고센터 (한국인터넷진흥원): (국번없이) 118 /{" "}
              <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>privacy.kisa.or.kr</a></li>
            <li>개인정보 분쟁조정위원회: (국번없이) 1833-6972 /{" "}
              <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>kopico.go.kr</a></li>
            <li>대검찰청 사이버범죄수사단: (국번없이) 1301 /{" "}
              <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>spo.go.kr</a></li>
            <li>경찰청 사이버수사국: (국번없이) 182 /{" "}
              <a href="https://ecrm.police.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>ecrm.police.go.kr</a></li>
          </ul>

          {/* ── 14. 변경 ── */}
          <h2>제14조 (개인정보 처리방침의 변경)</h2>
          <ol>
            <li>본 방침은 시행일로부터 적용되며, 법령·정책 또는 서비스 변경에 따라 내용이 추가·삭제·수정될 수
              있습니다.</li>
            <li>변경 사항은 시행 <strong>7일 전</strong>부터 서비스 내 공지합니다. 다만, 정보주체의 권리에 중대한 변경이 있는
              경우에는 <strong>30일 전</strong>에 공지합니다.</li>
            <li>변경 이력:
              <ul>
                <li>버전 1.0: 2026년 3월 14일 시행 (최초 수립)</li>
                <li>버전 1.1: 2026년 3월 14일 시행 (PIPC 2025 작성지침 반영 — 만 14세 미만 아동 조항, 국외 이전 조항, 자동수집장치 조항 추가, 거래기록 보존기간 상세화, 고충처리 부서 추가)</li>
              </ul>
            </li>
          </ol>

          <h2>제15조 (시행일)</h2>
          <p>본 개인정보 처리방침은 2026년 3월 14일부터 시행합니다.</p>

          <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>
              <span className={styles.placeholder}>[TODO_FOR_OWNER: 상호]</span>{" "}
              | 대표: <span className={styles.placeholder}>[TODO_FOR_OWNER: 대표자명]</span>{" "}
              | 사업자등록번호: <span className={styles.placeholder}>[TODO_FOR_OWNER: 사업자등록번호]</span>
              <br />
              주소: <span className={styles.placeholder}>[TODO_FOR_OWNER: 사업장 주소]</span>
              <br />
              고객센터: <span className={styles.placeholder}>[TODO_FOR_OWNER: 고객센터 이메일]</span>{" "}
              / <span className={styles.placeholder}>[TODO_FOR_OWNER: 고객센터 전화번호]</span>
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
