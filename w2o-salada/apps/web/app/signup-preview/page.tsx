export const metadata = {
  title: "W2O SALADA 회원가입",
};

export default function SignupPreviewPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        fontFamily: "Pretendard, -apple-system, sans-serif",
        color: "#1a1a1a",
        padding: "40px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#1D9E75",
              letterSpacing: "-0.5px",
              marginBottom: 4,
            }}
          >
            W2O SALADA
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#1a1a1a",
            }}
          >
            회원가입
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#888",
              marginTop: 6,
            }}
          >
            신선한 샐러드 새벽배송, 지금 시작하세요
          </div>
        </div>

        {/* Form Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: "32px 28px",
            marginBottom: 24,
          }}
        >
          {/* 이름 */}
          <FormField label="이름" required value="홍길동" />
          {/* 아이디 */}
          <FormField label="아이디" required value="user123" />
          {/* 이메일 */}
          <FormField label="이메일" required value="user@example.com" type="email" />
          {/* 비밀번호 */}
          <FormField label="비밀번호" required value="••••••••" />
          {/* 전화번호 */}
          <FormField label="전화번호" value="010-1234-5678" />
          {/* 배송지 주소 */}
          <FormField
            label="배송지 주소"
            value="서울특별시 강남구 테헤란로 123, 101동 1001호"
            last
          />
        </div>

        {/* 개인정보 수집 동의 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CheckboxChecked />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
              개인정보 수집 및 이용 동의 <span style={{ color: "#1D9E75" }}>(필수)</span>
            </span>
          </div>

          {/* 테이블 */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f7f7f7" }}>
                <th style={thStyle}>수집항목</th>
                <th style={thStyle}>수집목적</th>
                <th style={thStyle}>보유기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>이름, 이메일, 아이디, 비밀번호</td>
                <td style={tdStyle}>회원식별 및 서비스 제공</td>
                <td style={tdStyle}>회원 탈퇴 시까지</td>
              </tr>
              <tr>
                <td style={tdStyle}>전화번호</td>
                <td style={tdStyle}>배송 안내 및 주문 연락</td>
                <td style={tdStyle}>회원 탈퇴 시까지</td>
              </tr>
              <tr>
                <td style={tdStyle}>배송지 주소</td>
                <td style={tdStyle}>새벽배송 서비스 제공</td>
                <td style={tdStyle}>회원 탈퇴 시까지</td>
              </tr>
              <tr>
                <td style={tdStyle}>결제정보</td>
                <td style={tdStyle}>결제 처리 (토스페이먼츠 위탁)</td>
                <td style={tdStyle}>전자상거래법에 따라 5년</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 이용약관 동의 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: "20px 28px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckboxChecked />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
              이용약관 동의 <span style={{ color: "#1D9E75" }}>(필수)</span>
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 8, paddingLeft: 28 }}>
            <span style={{ color: "#1D9E75", textDecoration: "underline" }}>
              개인정보 처리방침
            </span>
            {" "}및{" "}
            <span style={{ color: "#1D9E75", textDecoration: "underline" }}>이용약관</span>
            에 동의합니다.
          </div>
        </div>

        {/* 회원가입 버튼 */}
        <div
          style={{
            backgroundColor: "#1D9E75",
            color: "#ffffff",
            textAlign: "center",
            padding: "16px 0",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 32,
            cursor: "pointer",
          }}
        >
          회원가입
        </div>

        {/* 간편 가입 디바이더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
          <span style={{ fontSize: 13, color: "#999", whiteSpace: "nowrap" }}>간편 가입</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e0e0e0" }} />
        </div>

        {/* 소셜 로그인 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {/* 카카오 */}
          <SocialButton
            bgColor="#FEE500"
            textColor="#3C1E1E"
            label="카카오로 시작하기"
            icon="K"
            dataText="수집 정보: 이메일, 닉네임, 프로필사진"
          />
          {/* 네이버 */}
          <SocialButton
            bgColor="#03C75A"
            textColor="#ffffff"
            label="네이버로 시작하기"
            icon="N"
            dataText="수집 정보: 이메일, 닉네임"
          />
          {/* Google */}
          <SocialButton
            bgColor="#ffffff"
            textColor="#3c4043"
            label="Google로 시작하기"
            icon="G"
            dataText="수집 정보: 이메일, 이름"
            border
          />
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            fontSize: 11.5,
            color: "#aaa",
            lineHeight: 1.8,
            borderTop: "1px solid #eee",
            paddingTop: 20,
          }}
        >
          <div>&copy; 2026 주식회사 다함푸드</div>
          <div>
            <span style={{ color: "#999", textDecoration: "underline" }}>개인정보처리방침</span>
            {" | "}
            <span style={{ color: "#999", textDecoration: "underline" }}>이용약관</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function FormField({
  label,
  value,
  required,
  type,
  last,
}: {
  label: string;
  value: string;
  required?: boolean;
  type?: string;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
        {label}
        {required ? (
          <span style={{ color: "#1D9E75", fontSize: 12, marginLeft: 4 }}>(필수)</span>
        ) : (
          <span style={{ color: "#aaa", fontSize: 12, marginLeft: 4 }}>(선택)</span>
        )}
      </div>
      <div
        style={{
          backgroundColor: "#f9f9f9",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "12px 14px",
          fontSize: 14,
          color: "#333",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CheckboxChecked() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        backgroundColor: "#1D9E75",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SocialButton({
  bgColor,
  textColor,
  label,
  icon,
  dataText,
  border,
}: {
  bgColor: string;
  textColor: string;
  label: string;
  icon: string;
  dataText: string;
  border?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          backgroundColor: bgColor,
          color: textColor,
          border: border ? "1px solid #dadce0" : "none",
          borderRadius: 8,
          padding: "13px 16px",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#aaa", marginTop: 4, paddingLeft: 52 }}>
        {dataText}
      </div>
    </div>
  );
}

/* ---- Shared styles ---- */

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #e0e0e0",
  textAlign: "left",
  fontWeight: 600,
  color: "#555",
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #f0f0f0",
  color: "#666",
  fontSize: 12,
  verticalAlign: "top",
};
