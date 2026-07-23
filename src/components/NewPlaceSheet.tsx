'use client';

import { CUISINE_COLOR, formatDistance, travelLabel, type NewPlace } from '@/lib/data';

// 신규 오픈 식당 상세 시트 — 방문 실적·리뷰가 없어 인허가 정보 중심으로 보여주고,
// 지도 링크는 새창으로 연결한다 (DetailSheet과 동일한 바텀시트 패턴).
export default function NewPlaceSheet({ place: p, onClose }: { place: NewPlace; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ animation: 'fadeIn 0.2s ease' }} />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-2xl bg-[#fffdf8] p-5 pb-8"
        style={{ animation: 'sheetUp 0.25s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">{p.name}</h2>
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: CUISINE_COLOR[p.cuisine] }}
              >
                {p.cuisine}
              </span>
              <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                🆕 새로 오픈
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{p.category}</p>
            <p className="mt-0.5 text-xs text-slate-400">{p.address}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-500"
          >
            닫기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-lg font-black text-emerald-700">{p.opened.replaceAll('-', '.')}</p>
            <p className="text-[11px] text-emerald-600">개업 신고일 (서울시 인허가)</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-black text-slate-900">{travelLabel(p.distM)}</p>
            <p className="text-[11px] text-slate-400">{formatDistance(p.distM)}</p>
          </div>
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          최근 1개월 내 개업 신고된 새 식당이라 아직 방문 실적·평점이 없어요. 다녀오시면 법인카드
          내역으로 자동 반영됩니다.
        </p>

        <div className="mt-4 flex gap-2">
          <a
            href={`https://map.kakao.com/link/search/${encodeURIComponent(p.name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-xl bg-[#3d0b12] py-3 text-center text-sm font-bold text-white"
          >
            카카오맵에서 보기
          </a>
          <a
            href={`https://map.naver.com/p/search/${encodeURIComponent(p.name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-xl bg-[#03C75A] py-3 text-center text-sm font-bold text-white"
          >
            네이버에서 보기
          </a>
        </div>
      </div>
    </div>
  );
}
