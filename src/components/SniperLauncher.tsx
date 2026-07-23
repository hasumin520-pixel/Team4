'use client';

import { useState } from 'react';

// 캐치테이블 빈자리 감시 — 개인 PC의 모심 에이전트(localhost 브리지)를 통해
// 본인 PC·본인 계정으로 Claude Code(catchtable-sniper 스킬)를 실행한다.
// 예약 자체는 캐치테이블 화면에서 직접 하고, 원하는 날짜에 자리가 없을 때
// "8월 2일 밍글스 저녁 2명 빈자리 감시해줘" 같은 프롬프트로 감시를 시작한다.
export const AGENT = 'http://localhost:43110';
export const SETUP_CMD = 'irm https://moim-blush.vercel.app/setup.ps1 | iex';

type AgentStatus = { agent: boolean; claude: boolean; skill: boolean; auth: boolean };

export default function SniperLauncher({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'launched' | 'setup' | 'mobile'>('idle');
  const [status, setStatus] = useState<AgentStatus>({ agent: false, claude: false, skill: false, auth: false });
  const [copied, setCopied] = useState(false);

  const tomorrow = new Date(Date.now() + 86400000);
  const example = `${tomorrow.getMonth() + 1}월 ${tomorrow.getDate()}일 ${name} 저녁 2명 빈자리 감시해줘`;

  const launch = async () => {
    // 모바일/태블릿에는 로컬 에이전트가 없다 — 타임아웃 대기 없이 바로 안내
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setState('mobile');
      return;
    }
    setState('checking');
    try {
      const res = await fetch(`${AGENT}/status`, { signal: AbortSignal.timeout(2500) });
      const s = (await res.json()) as Omit<AgentStatus, 'agent'>;
      setStatus({ agent: true, ...s });
      if (!s.claude || !s.skill) {
        setState('setup');
        return;
      }
      await fetch(`${AGENT}/snipe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, prompt: prompt.trim() }),
      });
      setState('launched');
    } catch {
      setStatus({ agent: false, claude: false, skill: false, auth: false });
      setState('setup');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('자동 복사가 막혀 있어요. 아래 명령을 직접 복사하세요:', SETUP_CMD);
    }
  };

  if (state === 'launched') {
    return (
      <div className="mt-2 rounded-xl bg-violet-50 p-3 text-center">
        <p className="text-sm font-bold text-violet-700">🎯 PC에서 Claude가 빈자리 감시를 시작했어요</p>
        <p className="mt-1 text-[11px] leading-relaxed text-violet-600">
          “{prompt.trim()}”
          <br />
          자리가 나면 바로 예약을 진행합니다. 결제가 필요한 단계에서는 반드시 직접 확인을 요청해요.
        </p>
        <button
          onClick={() => {
            setState('idle');
            setPrompt('');
          }}
          className="mt-1 text-[11px] text-violet-500 underline"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg bg-violet-600/10 py-2 text-center text-xs font-bold text-violet-700"
      >
        🎯 원하는 날짜에 자리가 없나요? — Claude 빈자리 감시 {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-[11px] leading-relaxed text-slate-600">
            언제·몇 명인지 문장으로 적어주세요. <b>내 PC의 Claude</b>가 취소표를 감시하다가 자리가
            나면 예약합니다.
          </p>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`예) ${example}`}
            className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => setPrompt(example)}
              className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-violet-600 ring-1 ring-violet-200"
            >
              예시 넣기
            </button>
            <button
              onClick={launch}
              disabled={state === 'checking' || !prompt.trim()}
              className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {state === 'checking' ? '내 PC 에이전트 확인 중...' : '🎯 감시 시작 (내 PC)'}
            </button>
          </div>

          {state === 'mobile' && (
            <div className="mt-2 rounded-lg border border-violet-200 bg-white/70 p-2.5">
              <p className="text-xs font-bold text-slate-700">📱 빈자리 감시는 PC 전용이에요</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                감시·예약은 <b>내 PC의 Claude</b>가 실행해요. PC 브라우저로 모심을 열고 같은 문장을
                입력해 주세요.
              </p>
            </div>
          )}

          {state === 'setup' && (
            <div className="mt-2 rounded-lg border border-violet-200 bg-white/70 p-2.5">
              <p className="text-xs font-bold text-slate-700">PC 에이전트 설정이 필요해요</p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                <CheckRow ok={status.agent} label="모심 PC 에이전트 실행" />
                <CheckRow ok={status.claude} label="Claude Code 설치" />
                <CheckRow ok={status.skill} label="catchtable-sniper 스킬 설치" />
                <CheckRow ok={status.auth} label="Claude 로그인 (미완이어도 실행 시 안내됨)" />
                <li className="flex items-center gap-1.5">
                  <span>🔗</span>
                  <a href="https://claude.ai/chrome" target="_blank" rel="noreferrer" className="underline">
                    Claude 크롬 확장
                  </a>
                  <span className="text-slate-400">· 캐치테이블 로그인 (직접 확인)</span>
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                PC의 PowerShell에 아래 한 줄을 붙여넣으면 자동 설치됩니다:
              </p>
              <button
                onClick={copy}
                className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-1.5 text-left font-mono text-[10px] text-emerald-300"
              >
                {copied ? '✅ 복사됨! PowerShell에 붙여넣으세요' : `${SETUP_CMD}  📋`}
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                감시·예약은 본인 PC의 로그인된 크롬에서 본인 계정으로 실행됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span>{ok ? '✅' : '❌'}</span>
      <span className={ok ? '' : 'font-semibold text-rose-600'}>{label}</span>
    </li>
  );
}
