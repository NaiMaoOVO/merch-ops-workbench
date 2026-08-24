#!/bin/bash
cd "$(dirname "$0")" || exit 1
if [ -f "工作台.html" ]; then
  open "工作台.html"
else
  echo "未找到 工作台.html，请确认压缩包已完整解压。"
  read -r -p "按回车键退出..."
fi
