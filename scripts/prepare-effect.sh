#!/usr/bin/env sh

set -eu

repo_dir=".repos/effect"
repo_url="https://github.com/Effect-TS/effect"

if [ -d "$repo_dir/.git" ]; then
  exit 0
fi

mkdir -p ".repos"
# Shallow: the checkout is read-only reference material, so history is dead weight.
git clone --depth 1 --single-branch "$repo_url" "$repo_dir"
