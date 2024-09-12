#! /usr/bin/env bash
set -o pipefail
set -eu

: ${page_title="ENTRY"}
: ${zip_file_name="$(date +js13k-2024-%m-%d-%H-%M.zip)"}
: ${iterations=30}

get_file_size() {
	test $# -ne 1 && return 64
	wc -c -- "$1" | xargs | cut -f 1 -d ' '
}

replace_if_smaller() {
	if [ -f "$1" ]; then
		if [ "$(get_file_size "$1")" -lt "$(get_file_size "$2")" ]; then
			mv -- "$1" "$2"
		else
			rm -- "$1"
		fi
	fi
}

cd "$(npm prefix)/dist/entry"

chmod 0644 "index.html"
zip --compression-method=deflate -9 --no-dir-entries --symlinks -r "${zip_file_name}" "index.html"

# ZIP recompression pipeline ported from FileOptimizer 14.30.2566
set +e	# Allow any of these to fail (likely because of unavailability).
leanify --iteration "${iterations}" --max_depth 1 "${zip_file_name}"
ect -zip -9 "${zip_file_name}"
advzip --recompress --shrink-insane --iter="${iterations}" "${zip_file_name}"
DeflOpt -a -b "${zip_file_name}"
if defluff < "${zip_file_name}" > "${zip_file_name}.tmp.zip"; then
	replace_if_smaller "${zip_file_name}.tmp.zip" "${zip_file_name}"
else
	rm -- "${zip_file_name}.tmp.zip"
fi
DeflOpt -a -b "${zip_file_name}"

# ZIP file verification
set -e
cmp "index.html" <(unzip -p "${zip_file_name}" "index.html")
advzip --pedantic --test "${zip_file_name}"
if [ -x "$(npm root)/@ronomon/zip/scripts/decode" ]; then
	"$(npm root)/@ronomon/zip/scripts/decode" "${zip_file_name}"
elif [ -x "$(npm root -g)/@ronomon/zip/scripts/decode" ]; then
	"$(npm root -g)/@ronomon/zip/scripts/decode" "${zip_file_name}"
fi

node ../../tools/cursize.js $(stat --printf="%s" "${zip_file_name}")

exit 0
