'use client';

import { CUISINE_COLOR, formatDistance, type Restaurant } from '@/lib/data';

// SVG 목업 지도 — 사업장(0,0) 기준 상대좌표(m).
const BASE_R = 1650; // 기본 viewBox 반경(m)

interface LabelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function MapView({
  restaurants,
  selected,
  onSelect,
  centerBadge = 'SK',
  centerLabel = '서린빌딩',
}: {
  restaurants: Restaurant[];
  selected: Restaurant | null;
  onSelect: (r: Restaurant) => void;
  centerBadge?: string; // 중심 마커 안 표시(본사='SK', 그 외=국기)
  centerLabel?: string; // 중심 마커 아래 라벨(사업장/도시명)
}) {
  // 축척: 가장 먼 식당이 아니라 80퍼센타일 거리 기준 — 아웃라이어 1~2곳이
  // 전체 지도를 축소시켜 밀집 지역이 점으로 뭉개지는 것을 방지(예: 휴스턴 Spring Branch)
  const dists = restaurants.map((r) => r.distM).sort((a, b) => a - b);
  const p80 = dists.length ? dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.8))] : 0;
  const R = Math.max(BASE_R, p80 * 1.3);
  const s = R / BASE_R; // 핀·글자 크기 보정 배율
  // 동심원: 기본 반경이면 500/1000/1500m, 확대되면 250m 단위의 1/3·2/3·풀 반경
  const rings =
    R === BASE_R ? [500, 1000, 1500] : [1 / 3, 2 / 3, 1].map((f) => Math.round((R * f) / 250) * 250);

  // 범위 밖 식당은 같은 방향 가장자리에 클램프(점선 링 표시 + 라벨에 실제 거리 병기)
  const MAX_D = R * 0.92;
  const pos = new Map<string, { x: number; y: number; clamped: boolean }>();
  for (const r of restaurants) {
    const x = r.dx;
    const y = -r.dy;
    const d = Math.hypot(x, y);
    pos.set(
      r.id,
      d <= MAX_D
        ? { x, y, clamped: false }
        : { x: (x * MAX_D) / d, y: (y * MAX_D) / d, clamped: true }
    );
  }

  // 라벨 배치(그리디 충돌 회피): 선택된 곳 → 방문횟수 상위 8곳 순으로,
  // 핀 위쪽에 놓다가 이미 놓인 라벨과 겹치면 아래쪽으로 플립, 그래도 겹치면 생략.
  // X는 지도 경계 안으로 클램프해 가장자리 핀의 라벨이 잘리지 않게 한다.
  const FONT = 95 * s;
  const textW = (t: string) =>
    [...t].reduce((w, ch) => w + (/[\x20-\x7E]/.test(ch) ? 0.58 : 1), 0) * FONT;
  const placedBoxes: LabelBox[] = [
    { x1: -95 * s, y1: -95 * s, x2: 95 * s, y2: 310 * s }, // 중심 뱃지 + 사업장 라벨 영역
  ];
  const labels: { r: Restaurant; text: string; x: number; y: number; sel: boolean }[] = [];
  const top8 = [...restaurants].sort((a, b) => b.visitCount - a.visitCount).slice(0, 8);
  const queue = selected ? [selected, ...top8.filter((r) => r.id !== selected.id)] : top8;
  for (const r of queue) {
    const sel = selected?.id === r.id;
    const p = pos.get(r.id);
    if (!p) continue;
    const text = p.clamped ? `${r.name} · ${formatDistance(r.distM)}` : r.name;
    const w = textW(text);
    const clampX = (x: number) => Math.max(-R + w / 2 + 30 * s, Math.min(R - w / 2 - 30 * s, x));
    const tryPlace = (baselineY: number): boolean => {
      const cx = clampX(p.x);
      const box = { x1: cx - w / 2, y1: baselineY - FONT, x2: cx + w / 2, y2: baselineY + 25 * s };
      if (box.y1 < -R + 10 * s || box.y2 > R - 10 * s) return false;
      if (placedBoxes.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1))
        return false;
      placedBoxes.push(box);
      labels.push({ r, text, x: cx, y: baselineY, sel });
      return true;
    };
    const above = p.y - 110 * s;
    const below = p.y + 110 * s + FONT * 0.9;
    if (!tryPlace(above) && !tryPlace(below) && sel) {
      labels.push({ r, text, x: clampX(p.x), y: above, sel }); // 선택된 식당은 항상 표시
    }
  }

  return (
    <div className="px-4">
      <div className="overflow-hidden rounded-xl bg-[#fffdf8] shadow-sm">
        <svg viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} className="block w-full">
          {/* 거리 동심원 */}
          {rings.map((d) => (
            <g key={d}>
              <circle
                cx={0}
                cy={0}
                r={d}
                fill="none"
                stroke="#eeaf72"
                strokeWidth={6 * s}
                strokeDasharray={`${24 * s} ${18 * s}`}
              />
              <text x={20 * s} y={-d + 60 * s} fontSize={80 * s} fill="#94A3B8">
                {d >= 1000 ? `${(d / 1000).toFixed(d % 1000 === 0 ? 0 : 2)}km` : `${d}m`}
              </text>
            </g>
          ))}

          {/* 식당 핀 (범위 밖은 가장자리 클램프 — 흰 링을 점선으로 구분) */}
          {restaurants.map((r) => {
            const isSel = selected?.id === r.id;
            const p = pos.get(r.id);
            if (!p) return null;
            return (
              <g
                key={r.id}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => onSelect(r)}
                className="cursor-pointer"
              >
                <circle
                  r={(isSel ? 90 : 55 + Math.min(r.visitCount, 30) * 1.5) * s}
                  fill={CUISINE_COLOR[r.cuisine]}
                  fillOpacity={isSel ? 1 : 0.85}
                  stroke="#fff"
                  strokeWidth={(isSel ? 20 : 10) * s}
                  strokeDasharray={p.clamped ? `${18 * s} ${12 * s}` : undefined}
                />
              </g>
            );
          })}

          {/* 중심(사업장) 마커 — 선택 위치에 따라 라벨/뱃지 변경 */}
          <g>
            <rect x={-90 * s} y={-90 * s} width={180 * s} height={180 * s} rx={40 * s} fill="#3d0b12" />
            <text y={35 * s} fontSize={85 * s} fill="#fff" textAnchor="middle" fontWeight={900}>
              {centerBadge}
            </text>
            <text
              y={280 * s}
              fontSize={95 * s}
              fill="#3d0b12"
              textAnchor="middle"
              fontWeight={900}
              stroke="#fffdf8"
              strokeWidth={20 * s}
              paintOrder="stroke"
            >
              {centerLabel}
            </text>
          </g>

          {/* 식당 라벨 — 핀·중심 마커 위에 그려 겹침 없이 항상 읽히게 */}
          {labels.map(({ r, text, x, y, sel }) => (
            <text
              key={r.id}
              x={x}
              y={y}
              fontSize={FONT}
              fontWeight={sel ? 900 : 500}
              fill="#334155"
              stroke="#fffdf8"
              strokeWidth={20 * s}
              paintOrder="stroke"
              textAnchor="middle"
              onClick={() => onSelect(r)}
              className="cursor-pointer"
            >
              {text}
            </text>
          ))}
        </svg>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        핀 크기 = 방문횟수 · 탭하면 상세 보기 · 점선 핀 = 지도 범위 밖(라벨에 실거리)
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {Object.entries(CUISINE_COLOR).map(([c, color]) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
