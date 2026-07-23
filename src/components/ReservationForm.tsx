'use client';

import SniperLauncher from './SniperLauncher';

// 예약 진입점 — 캐치테이블 예약은 캐치테이블 화면으로 바로 넘어가 직접 진행하고,
// 원하는 날짜에 자리가 없을 때만 아래 "빈자리 감시"(SniperLauncher)를 프롬프트로 가동한다.
// 미입점 식당은 네이버 딥링크 안내만 남긴다.
export default function ReservationForm({
  name,
  catchtable,
  catchtableUrl,
  overseas = false,
  googleUrl,
  address,
}: {
  name: string;
  catchtable: boolean;
  catchtableUrl?: string;
  overseas?: boolean; // 해외법인 소속 — 네이버 대신 구글 지도로 안내
  googleUrl?: string; // 구글맵 장소 페이지 (해외 실측 placeUrl)
  address?: string;
}) {
  const naverHref = `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  const googleHref =
    googleUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ? `${name} ${address}` : name)}`;

  if (!catchtable) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 p-3">
        <a
          href={overseas ? googleHref : naverHref}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center justify-center rounded-xl py-3 text-sm font-bold text-white ${
            overseas ? 'bg-[#1A73E8]' : 'bg-[#03C75A]'
          }`}
        >
          {overseas ? 'Google 지도에서 예약·전화 확인' : '네이버에서 예약·전화 확인'}
        </a>
        <p className="mt-1.5 text-[11px] text-slate-400">
          {overseas
            ? '해외 식당이에요 — Google 지도에서 Reserve(예약) 버튼이나 전화번호를 확인해 주세요.'
            : '캐치테이블 미입점 식당이에요 — 네이버 지도에서 예약 버튼이나 전화번호를 확인해 주세요.'}
        </p>
      </div>
    );
  }

  const catchHref =
    catchtableUrl ?? `https://app.catchtable.co.kr/ct/search?keyword=${encodeURIComponent(name)}`;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-stretch gap-2">
        <a
          href={catchHref}
          target="_blank"
          rel="noreferrer"
          className="flex flex-[1.5] items-center justify-center rounded-xl bg-orange-500 py-3 text-sm font-bold text-white"
        >
          캐치테이블에서 예약
        </a>
        <a
          href={naverHref}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center rounded-xl bg-[#03C75A]/10 py-3 text-xs font-bold text-[#03A050]"
        >
          네이버에서 보기
        </a>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        캐치테이블에서 날짜·인원을 골라 바로 예약하세요. 원하는 날짜에 자리가 없다면 아래 감시
        기능으로 취소표를 잡을 수 있어요.
      </p>
      <SniperLauncher name={name} />
    </div>
  );
}
