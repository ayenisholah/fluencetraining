# 0014. Custom domain with DNS kept in Namecheap

**Context.** The app has to be reachable at `lendloop.sholaayeni.xyz`. Clerk's production instance also needs its records on the same domain. The `sholaayeni.xyz` zone, which already holds the SES records, is hosted at Namecheap, the registrar. Delegating the subdomain to Route 53 would put every record under CDK, but the owner preferred to keep DNS in one place.

**Decision.**
- **All records live in Namecheap** and are added by hand:
  - `lendloop`: a CNAME to Amplify's CloudFront distribution, plus Amplify's certificate-validation CNAME;
  - `convex.lendloop`, `site.lendloop` and `n8n.lendloop`: A records to the host's Elastic IP;
  - Clerk's five CNAMEs (`clerk`, `accounts`, `clkmail` and two DKIM records) on the root domain.
- **`scripts/aws/dns-records.sh`** is read-only. It builds the full list from Amplify's domain association, the stack outputs and Clerk's Backend API, then checks each record in public DNS.
- **The domain is set in one place,** `infra/lib/config.ts`. The host reads it from SSM on each refresh, so changing it doesn't touch the instance.

**Consequences.**
- **Manual steps:** DNS changes aren't infrastructure as code. New or changed records are a documented manual step, verified by the script. Amplify's domain stays `PENDING_VERIFICATION` until its records exist.
- **Fixed address:** the Elastic IP must survive. It is retained with the stack, and replacing it means updating three A records.
- **Simple migration:** moving to Route 53 later is a delegation of `lendloop` plus record resources in CDK. The script already lists what to create.
