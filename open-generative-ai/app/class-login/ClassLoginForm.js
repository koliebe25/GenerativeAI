'use client';

import { useState } from 'react';

// Korean-first copy: this page only exists for classroom deployments.
export default function ClassLoginForm({ next }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('수업 코드를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/class-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      });
      if (res.ok) {
        window.location.href = next || '/';
        return;
      }
      setError(res.status === 401 ? '수업 코드가 맞지 않아요. 다시 확인해 주세요.' : '잠시 후 다시 시도해 주세요.');
    } catch {
      setError('인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-sm bg-[#0a0a0a]/90 border border-white/10 rounded-xl p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-[#22d3ee]/5 rounded-2xl flex items-center justify-center border border-[#22d3ee]/10 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10L12 5 2 10l10 5 10-5z" />
              <path d="M6 12v5c3 2 9 2 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">수업에 입장하기</h1>
          <p className="text-white/50 text-[13px] leading-relaxed">
            강사님께 받은 <span className="text-[#22d3ee]">수업 코드</span>를 입력하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="class-code" className="block text-xs font-bold text-white/40 ml-1">
              수업 코드
            </label>
            <input
              id="class-code"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder="예: class-ab12cd"
              className="w-full bg-white/5 border border-white/10 rounded-md px-5 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
              autoFocus
            />
            {error && <p className="mt-2 text-red-400 text-[12px] font-medium ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#22d3ee] text-black font-semibold py-2.5 rounded-md hover:bg-[#e5ff33] transition-colors disabled:opacity-60"
          >
            {busy ? '확인하는 중…' : '입장하기'}
          </button>

          <p className="text-center text-[12px] text-white/30 pt-1">
            이 기기에서 12시간 동안 다시 입력하지 않아도 돼요.
          </p>
        </form>
      </div>
    </div>
  );
}
