#!/bin/sh
# Rewrite MIRENAI_* placeholder tokens baked into the built assets with the
# container's runtime env values, so the API origin is set per-container.
for i in $(env | grep '^MIRENAI_'); do
  key=$(echo "$i" | cut -d '=' -f 1)
  value=$(echo "$i" | cut -d '=' -f 2-)
  find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.css' \) \
    -exec sed -i "s|${key}|${value}|g" '{}' +
done
