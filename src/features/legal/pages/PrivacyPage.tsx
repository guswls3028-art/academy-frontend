// PATH: src/features/legal/pages/PrivacyPage.tsx
// 개인정보 처리방침 — Korean Privacy Policy

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
          시행일: 2026년 3월 14일 | 버전 1.0
        </p>

        <article className={styles.article}>
          <p>
            <span className={styles.placeholder}>[TODO_FOR_OWNER: 상호]</span>(이하 "회사")는 개인정보 보호법 등
            관련 법령에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리하기 위하여
            다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          <h2>제1조 (개인정보의 수집 항목 및 수집 방법)</h2>

          <h3>1. 수집 항목</h3>
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
            </tbody>
          </table>

          <h3>2. 수집 방법</h3>
          <ul>
            <li>학원 운영자(원장) 또는 스태프가 서비스 내에서 직접 입력</li>
            <li>학생이 회원가입 신청 폼을 통해 직접 입력 (원장 승인 후 등록)</li>
            <li>서비스 이용 과정에서 자동 생성 (시험 성적, 출결 기록, 수업 영상 시청 기록, 메시지 발송 이력)</li>
          </ul>

          <h2>제2조 (개인정보의 수집·이용 목적)</h2>
          <ol>
            <li><strong>서비스 제공 및 운영:</strong> 학생 관리, 출결·성적·시험 관리, 수업 영상 제공, 과제 관리, 메시지 발송</li>
            <li><strong>회원 관리:</strong> 본인 확인, 서비스 이용 계약 이행, 계정 관리</li>
            <li><strong>커뮤니케이션:</strong> 공지사항 전달, 서비스 관련 안내, 학부모 연락</li>
            <li><strong>서비스 개선:</strong> 서비스 이용 통계 분석 (개별 식별 불가능한 집계 데이터)</li>
            <li><strong>스태프 관리:</strong> 근태 관리, 급여 정산</li>
          </ol>

          <h2>제3조 (개인정보의 보유 및 이용 기간)</h2>
          <ol>
            <li>회사는 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</li>
            <li>보유 기간:
              <ul>
                <li><strong>이용 계약 존속 기간:</strong> 서비스 이용 계약이 유효한 기간 동안 보유</li>
                <li><strong>계약 해지 후:</strong> 소프트 삭제(soft-delete) 처리 후 30일 경과 시 완전 파기</li>
                <li><strong>수업 영상:</strong> 삭제 요청 후 소프트 삭제 처리, 180일 경과 후 스토리지에서 완전 제거</li>
              </ul>
            </li>
            <li>관련 법령에 의해 보존이 필요한 경우, 해당 법령이 정한 기간 동안 보유합니다:
              <ul>
                <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약·청약철회 기록 5년, 대금결제 기록 5년</li>
                <li>통신비밀보호법: 접속 로그 기록 3개월</li>
              </ul>
            </li>
          </ol>

          <h2>제4조 (개인정보의 파기 절차 및 방법)</h2>
          <ol>
            <li><strong>파기 절차:</strong> 수집 목적이 달성된 개인정보는 별도의 DB(또는 별도 테이블)에 옮겨져
              내부 방침 및 관련 법령에 따라 일정 기간 저장 후 파기됩니다.</li>
            <li><strong>파기 방법:</strong>
              <ul>
                <li>전자적 파일: 기록을 재생할 수 없도록 데이터베이스에서 완전 삭제</li>
                <li>파일 스토리지(프로필 사진, 수업 영상 등): 클라우드 스토리지에서 오브젝트 삭제</li>
              </ul>
            </li>
          </ol>

          <h2>제5조 (개인정보의 제3자 제공)</h2>
          <p>
            회사는 정보주체의 개인정보를 제2조에서 명시한 범위 내에서만 처리하며, 원칙적으로 정보주체의 사전 동의
            없이 제3자에게 개인정보를 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다:
          </p>
          <ol>
            <li>정보주체가 사전에 동의한 경우</li>
            <li>법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위해 불가피한 경우</li>
          </ol>

          <h2>제6조 (개인정보 처리위탁)</h2>
          <p>
            회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다:
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
                <td>Amazon Web Services (AWS)</td>
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

          <h2>제7조 (정보주체의 권리·의무 및 행사 방법)</h2>
          <ol>
            <li>정보주체는 회사에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다:
              <ol>
                <li>개인정보 열람 요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제 요구</li>
                <li>처리 정지 요구</li>
              </ol>
            </li>
            <li>학생·학부모의 경우 해당 학원의 원장을 통해 권리를 행사하거나, 회사 고객센터에 직접 요청할 수
              있습니다.</li>
            <li>권리 행사는 서면, 전화, 이메일 등을 통해 가능하며, 회사는 지체 없이 조치합니다.</li>
            <li>정보주체가 개인정보의 오류에 대한 정정을 요구한 경우, 정정이 완료되기 전까지 해당 개인정보를
              이용하거나 제공하지 않습니다.</li>
          </ol>

          <h2>제8조 (개인정보의 안전성 확보 조치)</h2>
          <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
          <ol>
            <li><strong>관리적 조치:</strong> 개인정보 보호 내부 관리 계획 수립·시행, 접근 권한 관리</li>
            <li><strong>기술적 조치:</strong>
              <ul>
                <li>비밀번호 암호화 저장 (해시 알고리즘)</li>
                <li>통신 구간 암호화 (HTTPS/TLS)</li>
                <li>JWT 기반 인증 (쿠키 미사용, 세션 서버 미사용)</li>
                <li>테넌트(학원) 단위 데이터 논리적 격리</li>
                <li>데이터베이스 접근 제어</li>
              </ul>
            </li>
            <li><strong>물리적 조치:</strong> 클라우드 인프라 사업자(AWS)의 물리적 보안 정책에 따름</li>
          </ol>
          <p>
            본 서비스는 쿠키를 사용하지 않으며, 별도의 웹 분석·추적 도구(Google Analytics 등)를
            사용하지 않습니다.
          </p>

          <h2>제9조 (개인정보 보호책임자)</h2>
          <p>
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 정보주체의 불만 처리 및 피해 구제를 위하여
            아래와 같이 개인정보 보호책임자를 지정하고 있습니다:
          </p>
          <ul>
            <li>성명: <span className={styles.placeholder}>[TODO_FOR_OWNER: 개인정보 보호책임자 성명]</span></li>
            <li>연락처: <span className={styles.placeholder}>[TODO_FOR_OWNER: 개인정보 보호책임자 연락처]</span></li>
            <li>이메일: <span className={styles.placeholder}>[TODO_FOR_OWNER: 고객센터 이메일]</span></li>
          </ul>
          <p>
            정보주체는 서비스 이용 중 발생한 모든 개인정보 보호 관련 문의, 불만, 피해 구제 등에 관한 사항을
            개인정보 보호책임자에게 문의할 수 있습니다.
          </p>
          <p>
            기타 개인정보 침해에 대한 신고·상담이 필요한 경우 다음 기관에 문의할 수 있습니다:
          </p>
          <ul>
            <li>개인정보 침해신고센터: (국번없이) 118 / <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>privacy.kisa.or.kr</a></li>
            <li>개인정보 분쟁조정위원회: (국번없이) 1833-6972 / <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>kopico.go.kr</a></li>
            <li>대검찰청 사이버범죄수사단: (국번없이) 1301 / <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>spo.go.kr</a></li>
            <li>경찰청 사이버수사국: (국번없이) 182 / <a href="https://ecrm.police.go.kr" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>ecrm.police.go.kr</a></li>
          </ul>

          <h2>제10조 (개인정보 처리방침의 변경)</h2>
          <ol>
            <li>본 방침은 시행일로부터 적용되며, 법령·정책 또는 서비스 변경에 따라 내용이 추가·삭제·수정될 수
              있습니다.</li>
            <li>변경 사항은 시행 7일 전부터 서비스 내 공지합니다. 다만, 정보주체의 권리에 중대한 변경이 있는
              경우에는 30일 전에 공지합니다.</li>
          </ol>

          <h2>제11조 (시행일)</h2>
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
