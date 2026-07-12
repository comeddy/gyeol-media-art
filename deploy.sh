#!/usr/bin/env bash
# 「결 · GYEOL」 재배포 스크립트 — S3 업로드 대상 한정 + CloudFront 무효화
set -euo pipefail

REGION="us-east-1"
ACCT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="gyeol-media-art-${ACCT}"
DIST_ID="EHI3YANEVQ6IJ"

# 스크립트 위치 기준으로 이동(어디서 실행하든 동일 동작)
cd "$(dirname "$0")"

# 배포 대상 한정: index.html, making-of.html, css/, js/ 만 업로드.
# docs/, .superpowers/, .playwright-mcp/, .git, deploy.sh, *.md 등은 제외.
aws s3 sync . "s3://${BUCKET}" \
  --exclude "*" \
  --include "index.html" \
  --include "making-of.html" \
  --include "css/*" \
  --include "js/*" \
  --delete \
  --region "${REGION}"

# 전체 무효화
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output json

echo "배포 완료: https://gyeol.zerojin.art/"
