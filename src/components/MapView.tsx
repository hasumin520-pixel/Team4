'use client';

import { CUISINE_COLOR, type Restaurant } from '@/lib/data';

// SVG 목업 지도 — 사업장(0,0) 기준 상대좌표(m).
const BASE_R = 1650; // 기본 viewBox 반경(m)

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
  // 가장 먼 식당까지 담기도록 동적 확대 (해외 실식당은 수 km 밖도 있음)
  const R = Math.max(BASE_R, ...restaurants.map((r) => r.distM * 1.15));
  const s = R / BASE_R; // 핀·글자 크기 보정 배율
  // 동심원: 기본 반경이면 500/1000/1500m, 확대되면 250m 단위의 1/3·2/3·풀 반경
  const rings =
    R === BASE_R ? [500, 1000, 1500] : [1 / 3, 2 / 3, 1].map((f) => Math.round((R * f) / 250) * 250);
  // 라벨이 겹치지 않게 방문횟수 상위 8곳 + 선택된 곳만 이름 표시
  const labeled = new Set(
    [...restaurants]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 8)
      .map((r) => r.id)
  );

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

          {/* 식당 핀 */}
          {restaurants.map((r) => {
            const isSel = selected?.id === r.id;
            return (
              <g
                key={r.id}
                transform={`translate(${r.dx}, ${-r.dy})`}
                onClick={() => onSelect(r)}
                className="cursor-pointer"
              >
                <circle
                  r={(isSel ? 90 : 55 + Math.min(r.visitCount, 30) * 1.5) * s}
                  fill={CUISINE_COLOR[r.cuisine]}
                  fillOpacity={isSel ? 1 : 0.85}
                  stroke="#fff"
                  strokeWidth={(isSel ? 20 : 10) * s}
                />
                {(isSel || labeled.has(r.id)) && (
                  <text
                    y={-110 * s}
                    fontSize={95 * s}
                    fontWeight={isSel ? 900 : 500}
                    fill="#334155"
                    stroke="#fffdf8"
                    strokeWidth={20 * s}
                    paintOrder="stroke"
                    textAnchor="middle"
                  >
                    {r.name}
                  </text>
                )}
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
        </svg>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        핀 크기 = 방문횟수 · 탭하면 상세 보기 (목업 지도, 카카오맵 연동 예정)
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
