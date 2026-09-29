/**
 * Format API and studio error messages into clean, user-friendly strings.
 */

// The generic messages below follow the page language (Korean pages use
// <html lang="ko"> and live under /ko).
function isKoreanPage() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.lang === 'ko' || window.location.pathname.startsWith('/ko');
}

const MESSAGES = {
  en: {
    insufficientCredits: "Insufficient credits. Please top up your wallet.",
    authFailed: "Authentication failed. Please check your account session or API key.",
    tooManyRequests: "Too many requests. Please wait a moment and try again.",
    serverError: "The AI service had a temporary problem. Please try again in a moment.",
  },
  ko: {
    insufficientCredits: "크레딧(잔액)이 부족해요. Muapi 잔액을 충전해야 해요.",
    authFailed: "인증에 실패했어요. 페이지를 새로고침하거나 API 키를 확인해 주세요.",
    tooManyRequests: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    serverError: "AI 서버에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  },
};

// Common HTTP failures that get a friendly, translated message.
function knownFailure(message) {
  if (message.includes('402') || message.includes('INSUFFICIENT_CREDITS') || message.toLowerCase().includes('insufficient credits')) {
    return 'insufficientCredits';
  }
  if (message.includes('401') || message.includes('403')) return 'authFailed';
  if (message.includes('429')) return 'tooManyRequests';
  // 5xx status in the text before any JSON body, e.g. "API Request Failed: 502 - {...}"
  if (/\b5\d\d\b/.test(message.split('{')[0])) return 'serverError';
  return null;
}

export function formatErrorMessage(err, fallback = "Generation failed") {
  if (!err) return fallback;
  let message = typeof err === 'string' ? err : (err.message || fallback);
  const korean = isKoreanPage();
  const text = MESSAGES[korean ? 'ko' : 'en'];
  const failure = knownFailure(message);

  // Korean pages prefer the translated message over the API's English detail.
  if (korean && failure) return text[failure];

  // If message contains JSON payload (e.g. `API Request Failed: 402 Payment Required - {...}`)
  if (message.includes('{') && message.includes('}')) {
    try {
      const jsonStart = message.indexOf('{');
      const jsonStr = message.slice(jsonStart);
      const data = JSON.parse(jsonStr);
      if (data.detail && typeof data.detail === 'string') {
        return data.detail;
      }
      if (data.error?.message && typeof data.error.message === 'string') {
        return data.error.message;
      }
      if (data.message && typeof data.message === 'string') {
        return data.message;
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  // Handle common HTTP error codes
  if (failure) return text[failure];

  // Strip technical prefix like "API Request Failed: 500 Internal Server Error -"
  message = message.replace(/^API Request Failed: \d+ [^-]+ - /, '');

  return message.length > 150 ? message.slice(0, 147) + '...' : message;
}
