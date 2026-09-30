/**
 * 다음(카카오) 우편번호 API 공용 헬퍼
 *
 * 응답에서 배송 코스 설계에 필요한 값(시도·시군구·법정동·건물명·아파트 여부·도로명/지번)을
 * 가공 없이 뽑아 돌려준다. buildingName 은 단지 묶음의 키라 원문 그대로 둔다.
 */

export type DaumPostcodeData = {
  address: string;        // 사용자가 선택한 형태 (도로명 또는 지번)
  addressType: "R" | "J";
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  sido: string;
  sigungu: string;
  bname: string;          // 법정동
  bname1?: string;        // 법정리
  bcode?: string;         // 법정동 코드 10자리 — 배송 권역 매칭 키
  buildingName: string;
  apartment: "Y" | "N";
};

export type PickedAddress = {
  zipCode: string;
  bcode: string | null;
  address1: string;
  roadAddress: string | null;
  jibunAddress: string | null;
  sido: string | null;
  sigungu: string | null;
  bname: string | null;
  buildingName: string | null;
  isApartment: boolean;
};

declare global {
  interface Window {
    daum: { Postcode: new (opts: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void } };
  }
}

const SCRIPT_ID = "daum-postcode";

/** 스크립트를 한 번만 로드한다 (여러 화면에서 호출해도 안전) */
export function loadDaumPostcode(): void {
  if (typeof document === "undefined" || document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
  script.async = true;
  document.head.appendChild(script);
}

export function normalizeDaum(data: DaumPostcodeData): PickedAddress {
  const bname = data.bname || data.bname1 || "";
  return {
    zipCode: data.zonecode,
    bcode: data.bcode || null,
    // 주소 문자열에 건물명을 합치지 않는다 — buildingName 은 별도 필드로 보존
    address1: data.roadAddress || data.address,
    roadAddress: data.roadAddress || null,
    jibunAddress: data.jibunAddress || null,
    sido: data.sido || null,
    sigungu: data.sigungu || null,
    bname: bname || null,
    buildingName: data.buildingName || null,
    isApartment: data.apartment === "Y",
  };
}

/** 우편번호 창을 열고 선택 결과를 콜백으로 돌려준다. 스크립트가 아직이면 false */
export function openDaumPostcode(onPick: (picked: PickedAddress) => void): boolean {
  if (typeof window === "undefined" || !window.daum) return false;
  new window.daum.Postcode({ oncomplete: (data) => onPick(normalizeDaum(data)) }).open();
  return true;
}

/** 화면 표시용: 주소 + (건물명) */
export function formatAddressLine(address1: string, buildingName?: string | null): string {
  return buildingName && !address1.includes(buildingName) ? `${address1} (${buildingName})` : address1;
}

export const DROP_OPTIONS = [
  { value: "DOOR", label: "문 앞" },
  { value: "SECURITY_OFFICE", label: "경비실" },
  { value: "PARCEL_BOX", label: "택배함" },
  { value: "OTHER", label: "기타" },
] as const;
export type DropLocationValue = (typeof DROP_OPTIONS)[number]["value"];

export const DROP_LABEL: Record<string, string> = Object.fromEntries(DROP_OPTIONS.map((o) => [o.value, o.label]));

/** 배송지별 출입·수령 정보 (배송지마다 다르다) */
export type DeliveryDetails = {
  label: string;
  entranceMethod: string;
  entrancePassword: string;
  floor: string;
  dropLocation: DropLocationValue;
  dropNote: string;
};

export const emptyDeliveryDetails: DeliveryDetails = {
  label: "",
  entranceMethod: "",
  entrancePassword: "",
  floor: "",
  dropLocation: "DOOR",
  dropNote: "",
};
