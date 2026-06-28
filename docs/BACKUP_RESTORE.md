# Backup & Restore

## Automated backup

```bash
npm run backup:db
```

Creates a timestamped PostgreSQL dump in `backups/` (requires `DATABASE_URL` and `pg_dump` on PATH).

## Docker database backup

```bash
docker compose exec db pg_dump -U postgres schooldb > backups/manual-$(date +%Y%m%d).sql
```

## Restore

```bash
npm run restore:db -- backups/your-file.sql
```

Or manually:

```bash
psql $DATABASE_URL < backups/your-file.sql
```

## What to back up

| Asset | Method |
|-------|--------|
| PostgreSQL | `backup:db` script |
| Uploaded files | Copy `uploads/` directory |
| Environment | Secure secret store (not git) |
| Cloudinary | Cloudinary dashboard exports |

## Schedule

Recommended production schedule:

- **Database**: daily automated dump, retain 30 days
- **Uploads**: weekly sync to object storage
- **Verify restores**: monthly test restore to staging

## Pre-restore checklist

1. Stop backend to prevent writes
2. Notify users of maintenance window
3. Restore DB to staging first when possible
4. Run `npx prisma generate` after restore
5. Restart backend and verify `/api/health/ready`
