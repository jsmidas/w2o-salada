# 모바일 히어로 음식 아이콘

모바일 첫 화면에서 영상 위에 떠다니는 음식 일러스트입니다.

## 파일

| 파일 | 용도 |
|------|------|
| `salad.svg`   | 샐러드 (좌상단, 통통 튀는 애니메이션) |
| `banchan.svg` | 반찬 (우상단, 둥둥 떠다니는 애니메이션) |
| `simple.svg`  | 간편식 (중앙, 흔들리는 애니메이션) |

## 이미지 교체 방법

### 같은 파일명으로 덮어쓰기 (가장 간단)

위 3개 파일을 같은 이름으로 덮어쓰면 즉시 반영됩니다.

- 권장 비율: **정사각형 (1:1)**
- 권장 크기: **400×400px 이상** (Retina 대응)
- 권장 형식: **SVG** (벡터, 어떤 크기에서도 깨끗) > **PNG (투명배경)** > JPG
- 배경: **투명 배경** 권장 — 영상 위에 자연스럽게 얹힘

### 확장자를 바꾸려면

`apps/web/app/components/HeroSection.tsx`의 `MobileOverlay` 함수에서
`src` 경로를 수정하세요. 예: `/hero/salad.png`

## AI 이미지 생성 프롬프트 (예시)

ChatGPT, Midjourney, Stable Diffusion 등에서 사용:

**샐러드**
```
A cute, isometric 3D illustration of a fresh Korean-style salad bowl,
with cherry tomatoes, lettuce, corn, and nuts.
Transparent background, vibrant colors, food illustration style,
1:1 square aspect ratio.
```

**반찬**
```
A cute, isometric 3D illustration of a Korean banchan tray with
4 compartments: kimchi, namul (seasoned vegetables), braised dish, and rice.
Transparent background, warm colors, food illustration style,
1:1 square aspect ratio.
```

**간편식**
```
A cute, isometric 3D illustration of a Korean lunch box (dosirak)
with bulgogi, rice, and side dishes. Transparent background,
bright appetizing colors, food illustration style, 1:1 square aspect ratio.
```

## 공통 디자인 가이드

- 일러스트 톤: 친근하고 귀여운 느낌 (사진보다는 그림 스타일이 어울림)
- 색감: 브랜드 컬러(그린 #1D9E75, 앰버 #EF9F27)와 충돌하지 않게
- 외곽선이 살짝 있으면 영상 위에서 더 잘 보임
