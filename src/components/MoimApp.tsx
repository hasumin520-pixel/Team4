'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCOUNT_BY_PURPOSE,
  COMPANY,
  CUISINES,
  DIST_BANDS,
  PRICE_LABEL,
  PURPOSES,
  RESTAURANTS,
  buildRestaurants,
  type Cuisine,
  type Purpose,
  type Restaurant,
} from '@/lib/data';
import { buildStats, type Stats } from '@/lib/assign';
import { parseCardXlsx } from '@/lib/xlsx';
import RestaurantCard from './RestaurantCard';
import MapView from './MapView';
import KakaoMap from './KakaoMap';
import DetailSheet from './DetailSheet';

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

type Sort = 'visits' | 'rating' | 'distance';

const SORT_LABEL: Record<Sort, string> = {
  visits: '방문횟수순',
  rating: '평점순',
  distance: '가까운순',
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-rose-600 bg-rose-600 text-white'
          : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

export default function MoimApp() {
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [dist, setDist] = useState<number | null>(null);
  const [cuisines, setCuisines] = useState<Set<Cuisine>>(new Set());
  const [sort, setSort] = useState<Sort>('visits');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<Restaurant | null>(null);

  // ?view=map 딥링크 (서버 렌더는 항상 list라 mount 후 반영)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'map') setView('map');
  }, []);

  // 엑셀 업로드로 교체된 방문 통계 (localStorage 영속화)
  const [restaurants, setRestaurants] = useState<Restaurant[]>(RESTAURANTS);
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('moim-stats');
      if (saved) {
        setRestaurants(buildRestaurants(JSON.parse(saved) as Record<string, Stats>));
        setUploaded(true);
      }
    } catch {
      localStorage.removeItem('moim-stats');
    }
  }, []);

  const onFile = async (file: File) => {
    try {
      const txs = parseCardXlsx(await file.arrayBuffer());
      const stats = buildStats(txs);
      localStorage.setItem('moim-stats', JSON.stringify(stats));
      setRestaurants(buildRestaurants(stats));
      setUploaded(true);
      alert(`법인카드 내역 ${txs.length}건을 반영했어요.\n(식당 배정은 시연용 더미 매핑)`);
    } catch (e) {
      alert(`엑셀을 읽지 못했어요: ${e instanceof Error ? e.message : e}`);
    }
  };

  const resetData = () => {
    localStorage.removeItem('moim-stats');
    setRestaurants(RESTAURANTS);
    setUploaded(false);
  };

  const results = useMemo(() => {
    let list = restaurants.filter((r) => {
      if (purpose && !r.purposes.includes(purpose)) return false;
      if (budget && r.priceTier !== budget) return false;
      if (dist && r.distM > dist) return false;
      if (cuisines.size > 0 && !cuisines.has(r.cuisine)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'visits') return b.visitCount - a.visitCount || b.rating - a.rating;
      if (sort === 'rating') return b.rating - a.rating || b.visitCount - a.visitCount;
      return a.distM - b.distM;
    });
    return list;
  }, [restaurants, purpose, budget, dist, cuisines, sort]);

  const toggleCuisine = (c: Cuisine) => {
    setCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-xl font-black text-slate-900">
              모임 <span className="text-rose-600">.</span>
            </h1>
            <p className="text-xs text-slate-500">
              {COMPANY} 법인카드 실적 기반 식당 지도
            </p>
          </div>
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 ${
                  view === v ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
                }`}
              >
                {v === 'list' ? '목록' : '지도'}
              </button>
            ))}
          </div>
        </div>

        {/* 목적(계정) */}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 py-2">
          <Chip active={purpose === null} onClick={() => setPurpose(null)}>
            전체
          </Chip>
          {PURPOSES.map((p) => (
            <Chip
              key={p}
              active={purpose === p}
              onClick={() => setPurpose(purpose === p ? null : p)}
            >
              {p}
              <span className="ml-1 text-xs opacity-70">{ACCOUNT_BY_PURPOSE[p]}</span>
            </Chip>
          ))}
        </div>

        {/* 예산 · 거리 · 음식종류 */}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-3">
          {[1, 2, 3].map((t) => (
            <Chip key={t} active={budget === t} onClick={() => setBudget(budget === t ? null : t)}>
              {PRICE_LABEL[t]}
            </Chip>
          ))}
          <span className="shrink-0 self-center text-slate-300">|</span>
          {DIST_BANDS.map((d) => (
            <Chip key={d} active={dist === d} onClick={() => setDist(dist === d ? null : d)}>
              ~{d >= 1000 ? `${d / 1000}km` : `${d}m`}
            </Chip>
          ))}
          <span className="shrink-0 self-center text-slate-300">|</span>
          {CUISINES.map((c) => (
            <Chip key={c} active={cuisines.has(c)} onClick={() => toggleCuisine(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </header>

      {/* 정렬 · 결과 수 */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <b className="text-slate-900">{results.length}</b>곳
          {purpose && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">
              {ACCOUNT_BY_PURPOSE[purpose]}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          {uploaded ? (
            <button onClick={resetData} className="text-xs text-rose-500 underline">
              업로드 데이터 ✕
            </button>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-slate-400 underline"
            >
              엑셀 업로드
            </button>
          )}
        </p>
        <div className="flex gap-1 text-xs font-medium">
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-2.5 py-1 ${
                sort === s ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              {SORT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      {view === 'map' ? (
        KAKAO_KEY ? (
          <KakaoMap
            appKey={KAKAO_KEY}
            restaurants={results}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <MapView restaurants={results} selected={selected} onSelect={setSelected} />
        )
      ) : (
        <ul className="space-y-3 px-4">
          {results.map((r, i) => (
            <RestaurantCard
              key={r.id}
              restaurant={r}
              rank={sort === 'visits' ? i + 1 : undefined}
              onClick={() => setSelected(r)}
            />
          ))}
          {results.length === 0 && (
            <li className="rounded-xl bg-white p-8 text-center text-sm text-slate-400">
              조건에 맞는 식당이 없어요. 필터를 조정해 보세요.
            </li>
          )}
        </ul>
      )}

      {selected && <DetailSheet restaurant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
