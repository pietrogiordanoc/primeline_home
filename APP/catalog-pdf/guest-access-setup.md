# Catalog Guest Access

Guest and staff catalog views use the existing public Autumn 2026 PDF:

`https://fcdrjlzqrbvnbsehkqgm.supabase.co/storage/v1/object/public/PDF%20Catalog/Autumn%202026.pdf`

No private bucket or storage setup is required. The guest PDF endpoint checks the active guest session and then returns this public URL. Staff download still requires an authorized employee catalog session. Web-to-PDF staff transfers additionally require the server-side Supabase credentials described below.

## Invitations, sessions, and revocation

- Magic Links use URL fragments so ordinary page requests and referrers do not transmit the token. The guest page automatically redeems an invitation via POST when it loads. Email security scanners that execute page scripts may therefore activate an unused invitation and start its access period. Single-use verification links still require explicit confirmation.
- Invitations expire after 30 days unused. Customer access starts when redeemed and supports 24 hours, 7 days, 1 month, 3 months, or permanent access. The invitation can be reused on any browser or device while the grant is active; there is temporarily no device limit.
- The customer receives the access link. The verified inviting employee and Super Admin receive internal copies that identify the employee, customer, and access duration without including the access link. If an internal copy fails, customer access remains active and the sharing page reports the partial notification failure.
- Renewal verification links expire after 15 minutes and do not extend the grant. Browser sessions last at most seven days and never outlive a finite grant.
- A secure, HttpOnly device cookie binds a guest session to its browser; it is not an invitation or identity credential. A browser without a valid session must reopen the invitation or verify its email. No devices are registered or counted.
- Verification links are consumed in a conditional grant update; a session creation failure does not consume them. Expired verification claims are pruned on later verification attempts. Conditional updates also protect session invalidation against concurrent redemption.
- Super Admin can invalidate guest sessions for an active grant and optionally send a fresh verification link for that grant. This preserves its original expiration and inviter. The RESETS history retains earlier recorded device counts; new events do not claim a device count because devices are no longer tracked. Expired or revoked grants cannot be reset.
- Admin can revoke grants, including permanent access. Guest session and PDF endpoint requests re-check the grant, session version, and revocation state. The separate Web-to-PDF transfer claim uses an atomic conditional create and does not register devices.

## Web Catalog transfer

Set `PDF_CATALOG_TRANSFER_SECRET` in the Home Netlify functions environment to a dedicated, cryptographically random value of at least 32 UTF-8 bytes. Configure the same value only in the Web Catalog backend; do not expose it to browser code. For example, generate a random 32-byte value and encode it as base64url.

An authenticated guest may explicitly select **View as Web Catalog**. The prepared Home function validates the existing session and active grant, then returns an HS256 JWT in a no-store response. Navigation places it only in the Web Catalog URL fragment as `pdf_transfer`; it contains `customerEmail`, `sharedBy`, `pdfGrantId`, `source` (`pdf_catalog_share`), `iat`, `exp`, and `jti`, plus `iss` (`https://primelinedist.com`) and `aud` (`https://catalog.primelinedist.com`). `pdfGrantExpiresAt` is the grant expiration in Unix seconds, or `null` for a permanent grant. The ticket expiration is at most five minutes after issuance and never later than a finite grant expiration.

The Catalog Mode button in the header is available after staff or guest access is verified. Staff navigate directly to Web Catalog, while guests use the transfer described above. Hover or focus reveals the explanation; on touch devices, press and hold the button to show it without navigating.

Web Catalog must remove the fragment before loading analytics or third-party scripts and verify the HS256 signature, issuer, audience, source, timestamps, and customer email on its backend before using the data. A signed JWT is readable by its holder and is a bearer credential; it is not encrypted or single-use. Verification must not treat it alone as proof of email ownership, and an already issued credential cannot reflect subsequent PDF grant revocation without an additional server-side check.

## Web Catalog to PDF

The Web Catalog backend issues a separate HS256 credential with `iss` `https://catalog.primelinedist.com`, `aud` `https://primelinedist.com/.netlify/functions/catalog-web-transfer`, `source` `web_catalog_mode`, identity claims, `iat`, `exp`, and a unique `jti`. Its lifetime is at most 120 seconds. Home removes `#web_transfer` before loading external resources and posts the credential to the transfer function. Home atomically claims the hashed `jti` in the `prime-line-web-transfer-claims` Blobs store; a daily scheduled function removes claims only after expiration plus a safety margin.

For staff, configure these **server-only Netlify Functions** environment variables manually:

- `PDF_CATALOG_TRANSFER_SECRET`: the same dedicated secret configured in the Web Catalog backend.
- `WEB_CATALOG_SUPABASE_URL`: the URL of the Web Catalog Supabase project.
- `WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY`: that project's service-role key. It has broad privileges; never expose it to browsers or commit it.

Home checks the Supabase Auth user and matching active `staff` record before issuing a staff session, then rechecks them for the viewer, downloads, and sharing. Existing OTP sessions keep their existing behavior. For customers, Home requires an existing valid guest session bound to the browser and an active PDF grant matching the Web Catalog email. It reuses that session and never chooses a grant from a device cookie alone. Without a valid session, the customer must reopen the invitation or verify their email. Grant expiration and revocation continue to apply.

### Coordinated exact-grant transfer (unpublished preparation)

The prepared Home changes add `pdfGrantId` to the signed PDF-to-Web ticket and accept
an optional `pdfGrantId` UUID in a signed customer Web-to-PDF ticket. Home looks up
that exact grant, checks its email and active status, and creates a browser-bound
session with conditional grant updates. It never searches by email. A different
valid guest session is rejected rather than silently switched. Without the new claim,
the existing session requirement remains.

The prepared `validate-catalog-grants` endpoint accepts a signed, single-use Web
request and checks each exact grant ID, owner, original salesperson, status and
expiration against Home's grant store. It signs only eligible grants, using `null`
for a permanent grant's `expiresAt`. The Web receiver validates the response,
prefers permanent grants, and otherwise selects the latest expiration. Home rechecks
the selected grant when redeeming the transfer. Validation is a snapshot, not an
authorization for later Web requests. The updated Web registration verifier also
requires `pdfGrantId` and `pdfGrantExpiresAt`, so previously issued PDF-to-Web
tickets cannot be used with it.

Web must securely bind verified grants to the authenticated customer and protect
linking against replay; email or salesperson alone cannot reconstruct a grant.
The prepared Web contract requires authenticated existing-account linking and
single-use transfer credentials; both sides require a coordinated release.

This validation supports Web-to-PDF transfer only; it does not enforce expiration
on Web sessions or direct Web data access. Unified expiration requires an audited
distinction between independently authorized Web accounts and PDF-only leads,
and server-side checks for protected Web operations and existing sessions.
Do not copy secrets into browser code or logs.

`@netlify/blobs` 11 requires Node.js 22.12 or newer. Manually confirm the Netlify build and Functions runtime use a compatible version before deploying. The Web Catalog transfer issuer and its secret must also be configured and deployed manually by the user; no Supabase schema or configuration changes are made here. Scheduled cleanup runs on production deploys.

## Important public-PDF limitation

The existing PDF remains publicly accessible independently of Magic Link permissions. Magic Links control the Prime Line guest viewer and its access session; they do not protect the underlying PDF URL. The guest page does not display Prime Line Download PDF or Share Catalog actions, but this does not prevent someone from downloading, copying, or sharing the public PDF or its URL. The browser's built-in PDF controls may also be available.

The Magic Link is a bearer credential: forwarding it can transfer access to whoever redeems it first; it does not prove the recipient's identity.
