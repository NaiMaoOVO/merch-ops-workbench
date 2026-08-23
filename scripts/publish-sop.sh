#!/usr/bin/env bash
# 把 docs/SOP.md 同步到飞书 wiki 教程页（需要 lark-cli 用户身份已授权）。
# 用法：npm 仓库根目录下执行 ./scripts/publish-sop.sh
set -euo pipefail

WIKI_TOKEN="BxzKwBh7iiazwkkRbOicNOaZnoh"
WIKI_URL="https://my.feishu.cn/wiki/${WIKI_TOKEN}"
SOP_FILE="docs/SOP.md"

NODE_JSON=$(lark-cli wiki spaces get_node --params "{\"token\":\"${WIKI_TOKEN}\"}" --as user --format json)
OBJ_TOKEN=$(printf '%s' "$NODE_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const t=j.data?.node?.obj_token;if(!t){console.error('resolve obj_token failed');process.exit(1)}console.log(t)})")

echo "目标文档：$OBJ_TOKEN"
lark-cli docs +update --api-version v2 --doc "$OBJ_TOKEN" --command overwrite \
  --doc-format markdown --content "@${SOP_FILE}" --as user
echo '✅ SOP 已同步到飞书'
