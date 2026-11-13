#!/usr/bin/env bash
# Сборка под GitHub Pages (yak1to.github.io/ugol361) и публикация в ветку gh-pages.
set -euo pipefail
cd "$(dirname "$0")/.."
DEPLOY=pages npx astro build
tmp="$(mktemp -d)"
cp -R dist/. "$tmp/"
touch "$tmp/.nojekyll"   # иначе GitHub выбросит папку _astro
remote="$(git remote get-url origin)"
email="$(git config user.email)"
(
  cd "$tmp"
  git init -q -b gh-pages
  git config user.name "$(cd - >/dev/null && git config user.name)"
  git config user.email "$email"
  git add -A
  git commit -q -m "Сборка для GitHub Pages"
  git push -q -f "$remote" gh-pages
)
rm -rf "$tmp"
echo "Готово: https://yak1to.github.io/ugol361/ (обновится через 1–2 минуты)"
