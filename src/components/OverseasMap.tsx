'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { CUISINES, CUISINE_COLOR, type Restaurant } from '@/lib/data';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

type LeafletNS = typeof import('leaflet');
// leaflet은 CJS라 번들러 interop에 따라 default 유무가 갈린다 — 둘 다 대응
async function loadLeaflet(): Promise<LeafletNS> {
  const mod = (await import('leaflet')) as LeafletNS & { default?: LeafletNS };
  return mod.default ?? mod;
}

// 해외 출장지 실지도 — 카카오맵은 해외 타일이 없어 OpenStreetMap(Leaflet)으로 표시한다.
// 핀 스타일·동심원·중심 마커는 KakaoMap과 동일한 문법을 유지한다.
// 부모에서 key={officeName}으로 위치별 리마운트한다.
export default function OverseasMap({
  center,
  centerLabel,
  restaurants,
  selected,
  onSelect,
}: {
  center: { lat: number; lng: number };
  centerLabel: string;
  restaurants: Restaurant[];
  selected: Restaurant | null;
  onSelect: (r: Restaurant) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinLayerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const toLatLng = (p: { dx: number; dy: number }): [number, number] => [
    center.lat + p.dy / 111320,
    center.lng + p.dx / (111320 * Math.cos((center.lat * Math.PI) / 180)),
  ];

  // 지도 생성 (leaflet은 window 필요 — SSR 회피 위해 effect 안에서 동적 import)
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await loadLeaflet();
      if (disposed || !containerRef.current || mapRef.current) return;

      const maxDist = Math.max(500, ...restaurants.map((r) => r.distM));
      const zoom = maxDist > 5000 ? 12 : maxDist > 2500 ? 13 : maxDist > 1200 ? 14 : 15;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // 거리 동심원 + 사무소 마커
      for (const radius of [500, 1000, 1500]) {
        L.circle([center.lat, center.lng], {
          radius,
          weight: 1.5,
          color: '#64748B',
          dashArray: '6 5',
          fillColor: '#64748B',
          fillOpacity: 0.03,
        }).addTo(map);
      }
      L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#3d0b12;color:#fff;font-weight:900;font-size:11px;padding:4px 8px;border-radius:8px;white-space:nowrap;transform:translate(-50%,-50%)">${centerLabel}</div>`,
          iconSize: [0, 0],
        }),
        interactive: false,
      }).addTo(map);

      renderPins(L, map);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀 렌더 (필터 결과·선택 변경 시)
  const renderPins = (L: LeafletNS, map: LeafletMap) => {
    pinLayerRef.current?.remove();
    const layer = L.layerGroup();
    for (const r of restaurants) {
      const isSel = selected?.id === r.id;
      const t = (Math.sqrt(Math.min(Math.max(r.visitCount, 1), 40)) - 1) / (Math.sqrt(40) - 1);
      const base = Math.round(11 + 22 * t);
      const size = isSel ? Math.max(base, 24) : base;
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translate(-50%,-100%)">
          <div style="font-size:11px;font-weight:${isSel ? 900 : 600};color:#1e293b;
            text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${r.name}</div>
          <div style="width:${size}px;height:${size}px;border-radius:50%;
            background:${CUISINE_COLOR[r.cuisine]};border:2.5px solid #fff;
            box-shadow:0 0 0 1.5px rgba(0,0,0,.35),0 2px 5px rgba(0,0,0,.35)"></div>
        </div>`;
      const marker = L.marker(toLatLng(r), {
        icon: L.divIcon({ className: '', html, iconSize: [0, 0] }),
      });
      marker.on('click', () => onSelectRef.current(r));
      layer.addLayer(marker);
    }
    layer.addTo(map);
    pinLayerRef.current = layer;
  };

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = await loadLeaflet();
      renderPins(L, map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, selected]);

  // 선택 시 해당 위치로 이동
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.panTo(toLatLng(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const legendCuisines = CUISINES.filter((c) => restaurants.some((r) => r.cuisine === c));

  return (
    <div className="px-4">
      <div className="relative">
        {/* 타일만 흑백 — 컬러 핀이 도드라지게 (KakaoMap과 동일 스타일) */}
        <div
          ref={containerRef}
          className="z-0 h-[420px] w-full overflow-hidden rounded-xl bg-slate-200 shadow-sm [&_.leaflet-tile-pane]:grayscale"
        />
        <div className="absolute right-2 top-2 z-[500] flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-2 shadow-md">
          {legendCuisines.map((c) => (
            <div key={c} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ background: CUISINE_COLOR[c] }}
              />
              {c}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        핀 크기 = 방문횟수 · 탭하면 상세 보기 · 지도 © OpenStreetMap
      </p>
    </div>
  );
}
