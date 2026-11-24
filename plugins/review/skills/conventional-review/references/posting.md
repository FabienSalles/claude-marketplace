# Posting the approved comments

Only after step 7 of `SKILL.md`: the list was shown and approved. Write each comment body to a
file first (`c1.md`, `c2.md`…) so quoting never mangles Markdown.

## GitLab (`glab`)

Head commit, to compare with the one reviewed:

```bash
glab mr view <n> -R <host>/<group>/<project> -F json --jq .sha
```

Pending review (draft notes, visible to the user only):

```bash
glab mr note draft create <n> -R <host>/<group>/<project> --file <path> --line <new-line> -m "$(cat c1.md)"
glab mr note draft create <n> -R <host>/<group>/<project> -m "$(cat c2.md)"   # general comment
glab mr note draft list <n> -R <host>/<group>/<project>                       # what the user will see
```

Publish, on the second go only:

```bash
glab mr note draft publish <n> -R <host>/<group>/<project>
```

`glab mr note` and `glab mr note draft` are marked experimental (`glab` 1.131). If they fail,
the REST API does the same: `POST /projects/:id/merge_requests/:iid/draft_notes` then
`POST /projects/:id/merge_requests/:iid/draft_notes/bulk_publish`, through `glab api`.

## GitHub (`gh`)

Head commit:

```bash
gh pr view <n> --json headRefOid --jq .headRefOid
```

Pending review: a review created without `event` stays pending, visible to the user only.

```json
{
  "commit_id": "<head sha>",
  "comments": [
    { "path": "src/pay.ts", "line": 42, "side": "RIGHT", "body": "<content of c1.md>" }
  ]
}
```

```bash
gh api repos/{owner}/{repo}/pulls/<n>/reviews --method POST --input review.json
```

The user submits it from the PR's *Files changed* tab. A general comment, on the second go
only: `gh pr comment <n> --body-file c2.md`.

## Any other forge

Use its pending-review feature when it has one; otherwise post one comment at a time after the
approval. No CLI or API at hand: give the user the approved list to paste.
