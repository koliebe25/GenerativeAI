#!/usr/bin/env bash
# Open Generative AI 설치 스크립트
#
# 사용법 (GenerativeAI 저장소 맨 위 폴더에서):
#   bash scripts/setup-open-generative-ai.sh
#
# Mac / Linux / Windows(Git Bash) / Claude Code 클라우드 세션에서 동작합니다.
# 하는 일: ① Node.js 버전 확인 → ② 원본 코드(서브모듈) 내려받기 → ③ npm run setup
set -euo pipefail

cd "$(dirname "$0")/.."

# ① Node.js 18 이상인지 확인
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js가 없어요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  exit 1
fi
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 18 ]; then
  echo "❌ 지금 Node.js 버전은 $(node -v) 예요. 18 이상이 필요해요."
  exit 1
fi

# ② 원본 코드 + 하위 패키지 3개(서브모듈) 내려받기
echo "📥 원본 코드를 내려받는 중..."
git submodule update --init --recursive

# ③ 의존성 설치 + 내부 패키지 빌드 (보통 1~3분)
echo "📦 설치 중이에요... (1~3분 걸려요)"
cd open-generative-ai
npm run setup

echo ""
echo "✅ 설치 완료!"
echo "   웹 버전 실행:      cd open-generative-ai && npm run dev   → 브라우저에서 http://localhost:3000"
echo "   데스크톱 앱 실행:  cd open-generative-ai && npm run electron:dev"
