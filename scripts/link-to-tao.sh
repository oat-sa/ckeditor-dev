#!/usr/bin/env bash
# Sync a *built* CKEditor into tao-core's @oat-sa/tao-core-shared-libs for qtiCreator testing.
#
# Do NOT symlink the unbuilt ckeditor-dev tree: the web server refuses paths that escape
# the document root, and TAO expects the built ckeditor.js bundle (taofurigana is compiled in).
#
# Workflow:
#   1. Edit PATH CONFIG below (or export CKEDITOR_DEV / TAO_CORE_VIEWS)
#   2. cd "$CKEDITOR_DEV/dev/builder" && ./build.sh --unminified
#   3. ./scripts/link-to-tao.sh sync
#   4. Hard-refresh backoffice
#   5. ./scripts/link-to-tao.sh restore   when done
#
# For fast plugin iteration without TAO, use samples/taofurigana.html (dev loader, no build).
set -euo pipefail

# =============================================================================
# PATH CONFIG — replace the placeholders with real absolute paths on your machine
# You can also export CKEDITOR_DEV / TAO_CORE_VIEWS in the shell (env wins).
# =============================================================================
CKEDITOR_DEV="${CKEDITOR_DEV:-/path/to/ckeditor-dev}"
TAO_CORE_VIEWS="${TAO_CORE_VIEWS:-/path/to/nextgen-stack/tao/tao/views}"
# =============================================================================

SHARED_LIBS_CKEDITOR="${TAO_CORE_VIEWS}/node_modules/@oat-sa/tao-core-shared-libs/lib/ckeditor"
BACKUP_PATH="${SHARED_LIBS_CKEDITOR}.bak-before-link"
RELEASE_DIR="${CKEDITOR_DEV}/dev/builder/release/ckeditor"

is_placeholder_path() {
	local value="$1"
	[[ -z "$value" ]] \
		|| [[ "$value" == /path/to/* ]] \
		|| [[ "$value" == *"/path/to/"* ]] \
		|| [[ "$value" == *__SET_ME__* ]] \
		|| [[ "$value" == *CHANGE_ME* ]]
}

print_path_setup_help() {
	cat <<EOF >&2

Set the paths before running this script.

Option A — edit PATH CONFIG at the top of:
  $(cd "$(dirname "$0")" && pwd)/$(basename "$0")

Option B — export in your shell for this session:
  export CKEDITOR_DEV="/absolute/path/to/ckeditor-dev"
  export TAO_CORE_VIEWS="/absolute/path/to/nextgen-stack/tao/tao/views"

Current values:
  CKEDITOR_DEV=$CKEDITOR_DEV
  TAO_CORE_VIEWS=$TAO_CORE_VIEWS

EOF
}

require_paths_configured() {
	local ok=1

	if is_placeholder_path "$CKEDITOR_DEV"; then
		echo "error: CKEDITOR_DEV is still a placeholder (or empty)." >&2
		ok=0
	elif [[ ! -d "$CKEDITOR_DEV" ]]; then
		echo "error: CKEDITOR_DEV does not exist or is not a directory:" >&2
		echo "  $CKEDITOR_DEV" >&2
		ok=0
	elif [[ ! -f "$CKEDITOR_DEV/ckeditor.js" && ! -d "$CKEDITOR_DEV/plugins/taofurigana" ]]; then
		echo "error: CKEDITOR_DEV does not look like the ckeditor-dev repo:" >&2
		echo "  $CKEDITOR_DEV" >&2
		ok=0
	fi

	if is_placeholder_path "$TAO_CORE_VIEWS"; then
		echo "error: TAO_CORE_VIEWS is still a placeholder (or empty)." >&2
		ok=0
	elif [[ ! -d "$TAO_CORE_VIEWS" ]]; then
		echo "error: TAO_CORE_VIEWS does not exist or is not a directory:" >&2
		echo "  $TAO_CORE_VIEWS" >&2
		ok=0
	fi

	if [[ "$ok" -ne 1 ]]; then
		print_path_setup_help
		exit 1
	fi
}

usage() {
	cat <<EOF
Usage: $(basename "$0") <sync|restore|status>

  sync     Copy built release/ckeditor into shared-libs (backs up vendor copy once)
  restore  Restore the backed-up vendor copy
  status   Show current state

Paths (edit PATH CONFIG at top of this script, or export before running):
  CKEDITOR_DEV=$CKEDITOR_DEV
  TAO_CORE_VIEWS=$TAO_CORE_VIEWS
EOF
}

require_shared_path() {
	require_paths_configured

	if [[ ! -e "$SHARED_LIBS_CKEDITOR" && ! -L "$SHARED_LIBS_CKEDITOR" && ! -e "$BACKUP_PATH" ]]; then
		echo "error: shared-libs ckeditor path not found:" >&2
		echo "  $SHARED_LIBS_CKEDITOR" >&2
		echo "Install @oat-sa/tao-core-shared-libs under tao/tao/views first." >&2
		echo "Also verify TAO_CORE_VIEWS points at .../tao/tao/views" >&2
		print_path_setup_help
		exit 1
	fi
}

cmd_status() {
	require_shared_path
	echo "CKEDITOR_DEV=$CKEDITOR_DEV"
	echo "TAO_CORE_VIEWS=$TAO_CORE_VIEWS"
	if [[ -L "$SHARED_LIBS_CKEDITOR" ]]; then
		echo "BROKEN SETUP: symlink -> $(readlink "$SHARED_LIBS_CKEDITOR")"
		echo "Run: $(basename "$0") restore"
	elif [[ -d "$SHARED_LIBS_CKEDITOR" ]]; then
		local size
		local ckeditor_js="$SHARED_LIBS_CKEDITOR/ckeditor.js"
		if [[ ! -f "$ckeditor_js" ]]; then
			echo "error: ckeditor.js not found at $ckeditor_js" >&2
			return 1
		fi
		size="$(wc -c <"$ckeditor_js" | tr -d ' ')"
		if [[ "$size" -lt 50000 ]]; then
			echo "WARNING: ckeditor.js is only ${size} bytes (looks like unbuilt loader). Run restore or sync a build."
		else
			echo "Active copy at $SHARED_LIBS_CKEDITOR (ckeditor.js ${size} bytes)"
		fi
	else
		echo "Missing: $SHARED_LIBS_CKEDITOR"
	fi
	if [[ -e "$BACKUP_PATH" || -L "$BACKUP_PATH" ]]; then
		echo "Backup present: $BACKUP_PATH"
	fi
	if [[ -d "$RELEASE_DIR" ]]; then
		echo "Build release present: $RELEASE_DIR"
	else
		echo "No build release yet — run: cd $CKEDITOR_DEV/dev/builder && ./build.sh --unminified"
	fi
}

cmd_sync() {
	require_shared_path

	if [[ -L "$SHARED_LIBS_CKEDITOR" ]]; then
		echo "error: lib/ckeditor is a symlink (unsupported). Run: $(basename "$0") restore" >&2
		exit 1
	fi

	if [[ ! -f "$RELEASE_DIR/ckeditor.js" ]]; then
		echo "error: no built release at $RELEASE_DIR" >&2
		echo "Build first: cd $CKEDITOR_DEV/dev/builder && ./build.sh --unminified" >&2
		exit 1
	fi

	local release_size
	release_size="$(wc -c <"$RELEASE_DIR/ckeditor.js" | tr -d ' ')"
	if [[ "$release_size" -lt 50000 ]]; then
		echo "error: release ckeditor.js looks too small (${release_size} bytes) — not a real build" >&2
		exit 1
	fi

	if [[ ! -e "$BACKUP_PATH" ]]; then
		echo "Backing up vendor copy to $BACKUP_PATH"
		cp -a "$SHARED_LIBS_CKEDITOR" "$BACKUP_PATH"
	else
		echo "Backup already exists — leaving it untouched"
	fi

	echo "Syncing $RELEASE_DIR -> $SHARED_LIBS_CKEDITOR"
	rsync -a --delete \
		--exclude '.git' \
		--exclude '.bender' \
		--exclude 'node_modules' \
		"$RELEASE_DIR"/ "$SHARED_LIBS_CKEDITOR"/

	echo "Done. Hard-refresh backoffice. Restore with: $(basename "$0") restore"
}

cmd_restore() {
	require_shared_path

	if [[ -L "$SHARED_LIBS_CKEDITOR" ]]; then
		if [[ ! -e "$BACKUP_PATH" ]]; then
			echo "error: symlink present but no backup at $BACKUP_PATH" >&2
			exit 1
		fi
		rm "$SHARED_LIBS_CKEDITOR"
		mv "$BACKUP_PATH" "$SHARED_LIBS_CKEDITOR"
		echo "Removed symlink and restored vendor copy"
		exit 0
	fi

	if [[ ! -e "$BACKUP_PATH" ]]; then
		echo "No backup at $BACKUP_PATH — nothing to restore."
		exit 0
	fi

	rm -rf "$SHARED_LIBS_CKEDITOR"
	mv "$BACKUP_PATH" "$SHARED_LIBS_CKEDITOR"
	echo "Restored vendor copy to $SHARED_LIBS_CKEDITOR"
}

case "${1:-}" in
	sync) cmd_sync ;;
	restore|unlink) cmd_restore ;;
	link)
		echo "error: 'link' (symlink) was removed — it breaks RequireJS (symlink escapes web root)." >&2
		echo "Use: $(basename "$0") sync   after building with ./build.sh --unminified" >&2
		exit 1
		;;
	status) cmd_status ;;
	*) usage; exit 1 ;;
esac
