# Independent security evidence receiver

This Terraform module deploys the Nutrio anchor and critical-alert receiver in
an AWS account outside the Supabase trust boundary. It stores exact request
bodies in a versioned S3 bucket with Object Lock `COMPLIANCE` retention, uses
DynamoDB conditional transactions for replay/chain protection, encrypts with a
rotating customer KMS key, exposes only two throttled API Gateway routes behind
AWS WAF, and returns the signed acknowledgement contracts expected by Nutrio.

Create three independent random secrets (minimum 32 bytes) in AWS Secrets
Manager and pass only their ARNs. The anchor request and acknowledgement secrets
must differ. Use a remote encrypted Terraform backend with locking; never put
secret values in `.tfvars`.

```powershell
terraform init
terraform plan -out receiver.tfplan
terraform apply receiver.tfplan
```

Set the returned URLs and exact API hostname in the Supabase Edge secrets. Copy
the anchor acknowledgement secret separately into Supabase Vault as documented
in `docs/security/DEPLOYMENT_SECURITY_CHECKLIST.md`. Enable AWS CloudTrail data
events for this bucket and DynamoDB table, route CloudWatch/WAF alarms to an
independently monitored SOC channel, and restrict AWS administrator access with
MFA. Test in the protected `Security Staging` environment before production.

Object Lock compliance retention cannot be shortened or bypassed, including by
the root user. Choose `retention_days` with legal counsel and Qatar retention
requirements before first deployment. Destroying this stack is intentionally
not a normal incident-response operation.

