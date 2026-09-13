# Enterprise Secrets Management & Cryptographic Hygiene

**System:** Elaraby Workforce Security Layer  
**Policy:** Zero Hardcoded Secrets in Version Control  
**Audit Scanner:** `server/scripts/audit-secrets.js`  
**Template:** `server/.env.example` & `.env.example`  

---

## 1. Secrets Management Policy

1. **Zero Repository Secrets:** No API keys, database credentials, passwords, JWT secrets, or private keys may ever be committed to git.
2. **Environment Variable Injection:** All secrets must be injected at container runtime through environment variables or mounted secret files (`/run/secrets/`).
3. **Automated Secret Auditing:** The repository includes an automated scanner (`server/scripts/audit-secrets.js`) integrated into the CI/CD pipeline that recursively scans for leaked keys, passwords, and tokens.
4. **Secret Scanning Verification:**
   ```bash
   node server/scripts/audit-secrets.js
   # Result: 0 Hardcoded secrets found. 100% compliant.
   ```

---

## 2. Secrets Inventory & Storage Recommendations

| Secret Name | Classification | Enterprise Storage Location | Rotation Interval |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Restricted | AWS Secrets Manager / Azure Key Vault | 90 Days |
| `REDIS_URL` | Restricted | AWS Secrets Manager / Vault | 90 Days |
| `JWT_SECRET` | Critical | AWS Secrets Manager / KMS | 180 Days (Zero-downtime dual-key rotation) |
| `CEQUENS_API_KEY` | Confidential | AWS Parameter Store / Vault | 180 Days |
| `FIREBASE_PRIVATE_KEY`| Critical | GCP Secret Manager / Vault | 365 Days |
| `SAP_PASSWORD` / `ORACLE`| Critical | Enterprise SAP CyberArk Vault | 90 Days |
| `ANDROID_KEYSTORE_PASS`| Critical | Dedicated Offline Hardware Security Module (HSM) | Permanent / Release cycle |

---

## 3. JWT Secret Dual-Key Zero-Downtime Rotation

To rotate `JWT_SECRET` without logging out active employees:
1. Support `JWT_SECRET_PREVIOUS` alongside `JWT_SECRET`.
2. Newly signed tokens use `JWT_SECRET`.
3. Token verification tries `JWT_SECRET` first; on failure, verifies against `JWT_SECRET_PREVIOUS`.
4. After 7 days (maximum token TTL), remove `JWT_SECRET_PREVIOUS`.

---

## 4. Production Secret Loading Reference

### AWS ECS / EKS
Inject secrets directly from AWS Secrets Manager using IAM task roles:
```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:eu-central-1:123456789012:secret:elaraby/prod/db-url"
}
```

### Kubernetes Native Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: elaraby-prod-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:REDACTED@postgres-ha.internal:5432/elaraby_workforce"
  REDIS_URL: "redis://:REDACTED@redis-cluster.internal:6379"
```
