# Disaster Recovery

## Recovery objectives (targets)

| Metric | Target |
|--------|--------|
| RTO (recovery time) | < 4 hours |
| RPO (data loss) | < 24 hours (daily backups) |

## Incident severity levels

| Level | Example | Response |
|-------|---------|----------|
| P1 | Database down, all schools offline | Immediate — restore from backup |
| P2 | Payment gateway failure | Manual payments still work |
| P3 | Email/SMS outage | Queue retries; notify admins |
| P4 | Single school issue | Support ticket + tenant override |

## P1 — Full platform outage

1. Confirm scope: `GET /api/health/ready` from multiple locations
2. Check Docker/host: `docker compose ps`, disk space, memory
3. Review logs: `docker compose logs backend --tail 200`
4. If DB corrupt: restore latest backup (see [BACKUP_RESTORE.md](./BACKUP_RESTORE.md))
5. If app bug: roll back to last known-good image/commit
6. Post incident: log in `PlatformHealthIncident` via Super Admin

## P2 — Database failure

1. Start fresh Postgres container or failover replica
2. Restore latest `backups/*.sql`
3. `npx prisma generate && npm run dev:backend` (verify)
4. Reconcile Paystack payments from dashboard if webhook events were missed

## P3 — Region / hosting loss

1. Provision new VM or container cluster
2. Restore env secrets from vault
3. Restore DB + `uploads/`
4. Update DNS to new IP
5. Re-issue TLS certificates
6. Verify custom domain TXT records still valid

## Communication

- Use **Super Admin → Communications** for platform-wide status
- Email school admins from support desk for tenant-specific issues

## Testing DR

Quarterly drill:

1. Restore backup to staging environment
2. Run `npm run test:all`
3. Verify login, fees, and public site
4. Document time to recover
