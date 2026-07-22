'use client';

import { useEffect, useRef } from 'react';
import { COMPANY_LATLNG, CUISINE_COLOR, latLngOf, type Restaurant } from '@/lib/data';

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => object;
        Map: new (el: HTMLElement, opts: object) => { setCenter: (p: object) => void };
        Circle: new (opts: object) => { setMap: (m: object | null) => void };
        Marker: new (opts: object) => { setMap: (m: object | null) => void };
        CustomOverlay: new (opts: object) => { setMap: (m: object | null) => void };
      };
    };
  }
}

const SDK_ID = 'kakao-map-sdk';

export default function KakaoMap({
  appKey,
  restaurants,
  selected,
  onSelect,
}: {
  appKey: string;
  restaurants: Restaurant[];
  selected: Restaurant | null;
  onSelect: (r: Restaurant) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ setCenter: (p: object) => void } | null>(null);
  const overlaysRef = useRef<{ setMap: (m: object | null) => void }[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // SDK 로드 + 지도 생성 (1회)
  useEffect(() => {
    const init = () => {
      window.kakao!.maps.load(() => {
        const { maps } = window.kakao!;
        if (!containerRef.current || mapRef.current) return;
        const center = new maps.LatLng(COMPANY_LATLNG.lat, COMPANY_LATLNG.lng);
        const map = new maps.Map(containerRef.current, { center, level: 6 });
        mapRef.current = map;

        // 거리 동심원 + 회사 마커
        for (const radius of [500, 1000, 1500]) {
          new maps.Circle({
            center,
            radius,
            strokeWeight: 1.5,
            strokeColor: '#64748B',
            strokeStyle: 'dashed',
            fillColor: '#64748B',
            fillOpacity: 0.03,
          }).setMap(map);
        }
        new maps.CustomOverlay({
          position: center,
          content:
            '<div style="background:#3d0b12;color:#fff;font-weight:900;font-size:11px;padding:4px 8px;border-radius:8px">SK서린빌딩</div>',
          yAnchor: 0.5,
        }).setMap(map);

        renderPins();
      });
    };

    if (window.kakao?.maps) {
      init();
      return;
    }
    let script = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SDK_ID;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // 식당 핀 렌더 (필터 결과 바뀔 때마다)
  const renderPins = () => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    for (const r of restaurants) {
      const { lat, lng } = latLngOf(r);
      const isSel = selected?.id === r.id;
      const size = isSel ? 18 : 10 + Math.min(r.visitCount, 30) / 4;
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';
      el.innerHTML = `
        <div style="font-size:11px;font-weight:${isSel ? 900 : 500};color:#334155;
          text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${r.name}</div>
        <div style="width:${size}px;height:${size}px;border-radius:50%;
          background:${CUISINE_COLOR[r.cuisine]};border:2px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`;
      el.addEventListener('click', () => onSelectRef.current(r));
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(lat, lng),
        content: el,
        yAnchor: 1,
        clickable: true,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(renderPins, [restaurants, selected]);

  return (
    <div className="px-4">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-xl bg-slate-200 shadow-sm"
      />
      <p className="mt-2 text-center text-[11px] text-slate-400">
        핀 크기 = 방문횟수 · 탭하면 상세 보기
      </p>
    </div>
  );
}
