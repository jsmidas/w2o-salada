/**
 * 상품 카드에 보여줄 BEST/NEW 배지.
 * 태그는 관리자가 Product.tags 에 손으로 넣는 값이라, 아직 팔 수 없는 상품에도 남아 있을 수 있다.
 * 상품명에 "준비중"이 있거나 비공개(isActive=false)·재고 0이면 배지를 숨긴다.
 */
export function productBadge(p: {
  name: string;
  tags?: string | null;
  isActive?: boolean;
  stock?: number | null;
}): string | null {
  const tag = p.tags?.trim();
  if (!tag) return null;
  if (p.isActive === false) return null;
  if (typeof p.stock === "number" && p.stock <= 0) return null;
  if (/준비\s*중/.test(p.name)) return null;
  return tag;
}
