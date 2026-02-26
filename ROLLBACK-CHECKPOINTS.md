# Rollback Checkpoints

Created: 2026-02-26  
Purpose: Safe restore point before implementing `Client-Promised Pending` items.

## Front-End Repo (`lcdb-astro`)

- Branch: `backup/20260226-pre-client-promised`
- Tag: `checkpoint-20260226-pre-client-promised`
- Commit: `460a866e3eb6ab8d1e2869256385408b3bb0cec4`

Current working-tree notes at checkpoint creation:
- Modified: `TODO-ISR.md`
- Untracked: `PENDING-POINTS.md`

Restore options:
```bash
# move to backup branch
git checkout backup/20260226-pre-client-promised

# or inspect exact tag commit
git checkout checkpoint-20260226-pre-client-promised
```

## Payload Admin Repo (`payload-admin`)

- Branch: `backup/20260226-pre-client-promised`
- Tag: `checkpoint-20260226-pre-client-promised`
- Commit: `32220827d49d6b34c4e0fd66866d5581a3e0cfed`

Current working-tree notes at checkpoint creation:
- Untracked: `.next_stale/`, `.next_stale_20260205-172249/`, `admin.ini`, `back.ini`

Restore options:
```bash
# move to backup branch
git -C payload-admin checkout backup/20260226-pre-client-promised

# or inspect exact tag commit
git -C payload-admin checkout checkpoint-20260226-pre-client-promised
```

