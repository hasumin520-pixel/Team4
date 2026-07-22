'use client';

import { useEffect, useState } from 'react';
import { AGENT, SETUP_CMD } from './SniperLauncher';

// 빈자리 감시 기능 소개 — PC 전용 기능이라 모바일 컬럼 밖 오른쪽 빈 공간에
// 접이식 배너로 표시한다 (xl 미만 화면에서는 숨김). 기본은 접힘, 상태 점으로 준비 여부 표시.
export default function SniperBanner() {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<'unknown' | 'ready' | 'partial' | 'none'>('unknown');
  const [copied, setCopied] = useState(false);

  // 배너가 보이는 넓은 화면에서만 에이전트 진단 (모바일에서 불필요한 localhost 요청 방지)
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1280px)').matches) return;
    (async () => {
      try {
        const res = await fetch(`${AGENT}/status`, { signal: AbortSignal.timeout(2000) });
        const s = (await res.json()) as { claude: boolean; skill: boolean; auth: boolean };
        setAgent(s.claude && s.skill && s.auth ? 'ready' : 'partial');
      } catch {
        setAgent('none');
      }
    })();
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(SETUP_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const DOT: Record<typeof agent, string> = {
    unknown: 'bg-slate-300',
    ready: 'bg-emerald-500',
    partial: 'bg-amber-400',
    none: 'bg-rose-400',
  };

  return (
    <aside className="fixed left-[calc(50%+256px)] top-28 z-30 hidden w-72 xl:block">
      <div className="overflow-hidden rounded-xl border border-violet-200 bg-white/80 shadow-sm backdrop-blur">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <span>🎯</span>
          <b className="flex-1 truncate text-sm text-violet-800">Claude 빈자리 감시</b>
          <span className={`h-2 w-2 rounded-full ${DOT[agent]}`} title="내 PC 에이전트 상태" />
          <span className="text-xs text-violet-400">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="border-t border-violet-100 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-slate-600">
              꽉 찬 식당도 <b>내 PC</b>의 Claude가 캐치테이블 취소표를 감시해 예약을 시도합니다.
              식당 상세 → 예약의 <b className="text-violet-700">🎯 버튼</b>으로 시작하세요.
            </p>

            <p className="mt-2 text-[11px] font-semibold">
              {agent === 'ready' && <span className="text-emerald-600">✅ 이 PC는 준비 완료</span>}
              {agent === 'partial' && <span className="text-amber-600">⚠️ 설정 미완 — 아래 명령을 다시 실행하면 Claude가 안내해요</span>}
              {agent === 'none' && <span className="text-rose-500">❌ 미설정 — 최초 1회 설치 필요</span>}
              {agent === 'unknown' && <span className="text-slate-400">에이전트 확인 중...</span>}
            </p>

            {agent !== 'ready' && (
              <button
                onClick={copy}
                className="mt-1.5 w-full rounded-lg bg-slate-800 px-2 py-1.5 text-left font-mono text-[10px] text-emerald-300"
              >
                {copied ? '✅ 복사됨! PowerShell에 붙여넣으세요' : `${SETUP_CMD}  📋`}
              </button>
            )}

            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
              본인 PC·본인 캐치테이블 계정으로 실행 · 결제 단계는 직접 확인 · Claude 크롬 확장 필요
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
