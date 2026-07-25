#!/bin/bash

set -eu

STATE=${1:-}
MODE=${2:-iteration}

if [ -z "$STATE" ]; then
    printf 'usage: goal-auto-gate.sh <state-file> [--dod]\n' >&2
    exit 2
fi

if [ ! -f "$STATE" ]; then
    printf 'state file not found: %s\n' "$STATE" >&2
    exit 2
fi

get() {
    sed -n "s/^$1=//p" "$STATE" | tail -1
}

fail() {
    printf 'HALT\n\nREASON: %s\n\nDETAIL:\n%s\n' "$1" "$2"
    exit 1
}

dupes=$(sed -n 's/^\([a-z_][a-z0-9_]*\)=.*/\1/p' "$STATE" | sort | uniq -d | tr '\n' ' ')

if [ -n "$dupes" ]; then
    fail "The state file declares the same key twice." "$(printf 'Duplicated: %s\n\nEach iteration rewrites the state file whole. Appending leaves the previous iteration keys behind, and a stale gate would be replayed against the current iteration.' "$dupes")"
fi

spec=$(get spec)

if [ -z "$spec" ] || [ ! -f "$spec" ]; then
    fail "The state file does not point at a readable spec." "spec=$spec"
fi

if [ "$MODE" = "--dod" ]; then
    n=1
    while :; do
        cmd=$(get "dod$n")
        if [ -z "$cmd" ]; then
            break
        fi
        out=$(eval "$cmd" 2>&1) && rc=0 || rc=$?
        if [ "$rc" -ne 0 ]; then
            fail "Global Definition of Done check $n failed." "$(printf 'Command: %s\nExit code: %s\n\nOutput:\n%s\n\nEvery iteration is green individually, but the whole does not hold. Nothing was pushed.' "$cmd" "$rc" "$(printf '%s' "$out" | tail -c 4000)")"
        fi
        n=$((n + 1))
    done
    if [ "$n" -eq 1 ]; then
        fail "The global Definition of Done declares no check." "$(printf 'No dod1 key in %s.\n\nAn empty barrier exits 0, so the run would push on the strength of nothing. Write the plan DoD commands into the state file, or halt and report that the plan has no machine-checkable DoD.' "$STATE")"
    fi
    printf 'OK: global Definition of Done passed (%s checks).\n' "$((n - 1))"
    exit 0
fi

iter=$(get iteration)
declared=$(get iteration_files)
hash_ref=$(get spec_hash)

if [ -z "$declared" ]; then
    fail "Iteration $iter declares no file." "$(printf 'iteration_files is empty in %s.\n\nWith nothing declared the scope check has no reference, so it can neither pass nor mean anything. Write the iteration Files to touch into the state file.' "$STATE")"
fi

if [ -n "$hash_ref" ]; then
    hash_now=$(sed 's/^- \[x\]/- [ ]/' "$spec" | shasum | cut -d' ' -f1)
    if [ "$hash_now" != "$hash_ref" ]; then
        fail "The spec was modified during iteration $iter, beyond ticking [x]." "$(printf 'Expected normalized content hash %s, found %s.\nThe executor rewrote its own contract. Review %s and the last diff before resuming.' "$hash_ref" "$hash_now" "$spec")"
    fi
fi

set -f

for d in $declared; do
    case "$d" in
        *'`'*|*'('*|*')'*|*'*'*|*'?'*|*'['*)
            fail "The declared file list is not a list of paths." "$(printf 'Unusable entry: %s\n\nDeclared: %s\n\niteration_files holds bare, space-separated, repo-relative paths and nothing else: no backticks, no glob, no markdown annotation. A whole subtree is declared by a trailing slash (plugins/astro/).' "$d" "$declared")"
            ;;
    esac
done

is_declared() {
    p=${1%\"}
    p=${p#\"}
    for d in $declared; do
        case "$p" in
            "$d") return 0 ;;
            "$d"*) case "$d" in */) return 0 ;; esac ;;
        esac
    done
    return 1
}

if ! status=$(git status --porcelain -uall 2>&1); then
    fail "git status failed, so the scope check never ran." "$(printf '%s\n\nThe gate reads the tree it is standing in: run it with the repository — or the track worktree — as the working directory. A scope check that cannot see the tree is not a check, and must never exit 0.' "$status")"
fi

leak=""
parasite=""
while IFS= read -r line; do
    if [ -z "$line" ]; then
        continue
    fi
    st=$(printf '%s' "$line" | cut -c1-2)
    rest=$(printf '%s' "$line" | cut -c4-)
    old=""
    new=$rest
    case "$rest" in
        *" -> "*) old=${rest%% -> *}; new=${rest##* -> } ;;
    esac
    for p in "$new" "$old"; do
        if [ -z "$p" ] || is_declared "$p"; then
            continue
        fi
        case "$st" in
            "??") parasite="$parasite $p" ;;
            *) leak="$leak $p" ;;
        esac
    done
done <<EOF
$status
EOF

set +f

if [ -n "$leak" ]; then
    fail "Scope leak on iteration $iter." "$(printf 'Tracked files changed but NOT declared in "Files to touch":%s\n\nDeclared: %s\n\ngit status --short:\n%s' "$leak" "$declared" "$(git status --short -uall)")"
fi

if [ -n "$parasite" ]; then
    fail "Parasitic artifacts in the working tree after iteration $iter." "$(printf 'Untracked files not declared by the iteration:%s\n\ngit status --short:\n%s' "$parasite" "$(git status --short -uall)")"
fi

n=1
while :; do
    cmd=$(get "gate$n")
    if [ -z "$cmd" ]; then
        break
    fi
    out=$(eval "$cmd" 2>&1) && rc=0 || rc=$?
    if [ "$rc" -ne 0 ]; then
        fail "Acceptance command $n failed for iteration $iter." "$(printf 'Command: %s\nExit code: %s\n\nOutput:\n%s' "$cmd" "$rc" "$(printf '%s' "$out" | tail -c 4000)")"
    fi
    n=$((n + 1))
done

if [ "$n" -eq 1 ]; then
    fail "Iteration $iter declares no acceptance command." "$(printf 'No gate1 key in %s.\n\nAn iteration with no gate exits 0 without proving anything, which is exactly what the loop must never advance on. Give the iteration a command-line criterion, or halt and report that this slice cannot be verified unattended.' "$STATE")"
fi

printf 'OK: iteration %s passed %s acceptance command(s), no scope leak, no parasitic artifact, spec untouched.\n' "$iter" "$((n - 1))"
exit 0
