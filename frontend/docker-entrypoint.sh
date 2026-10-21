#!/bin/sh
set -eu

# Presets remain configurable at container startup without rebuilding the bundle.
if ! preset=$(printf '%s' "${VITE_PRESET_SECTIONS:-[]}" | jq -ce 'if type == "array" then . else error("Expected an array") end' 2>/dev/null); then
    printf '%s\n' 'VioletDen: invalid preset sections; using an empty list.' >&2
    preset='[]'
fi
encoded=$(printf '%s' "$preset" | jq -Rs .)
printf 'globalThis.__VITE_PRESET_SECTIONS__ = %s;\n' "$encoded" > /usr/share/nginx/html/runtime-config.js
