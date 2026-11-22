# Catalog Guest Access

Guest and staff catalog views use the existing public Autumn 2026 PDF:

`https://fcdrjlzqrbvnbsehkqgm.supabase.co/storage/v1/object/public/PDF%20Catalog/Autumn%202026.pdf`

No private bucket, catalog-specific Supabase credentials, or storage setup is required. The guest PDF endpoint checks the active guest session and then returns this public URL. Staff download still requires an authorized employee catalog session.

## Invitations, sessions, and revocation

- Magic Links use URL fragments so ordinary page requests and referrers do not transmit the token. A GET only loads the confirmation page; redemption happens after the customer explicitly confirms.
- Invitations expire after 30 days unused. Customer access starts when redeemed and supports 24 hours, 7 days, 1 month, 3 months, or permanent access. The invitation can be reused on up to three devices while the grant is active.
- The customer receives the access link. The verified inviting employee and Super Admin receive internal copies that identify the employee, customer, and access duration without including the access link. If an internal copy fails, customer access remains active and the sharing page reports the partial notification failure.
- Renewal verification links expire after 15 minutes and do not extend the grant. Browser sessions last at most seven days and never outlive a finite grant.
- Netlify Blobs stores invitation, grant, session, verification, and hashed token-claim records in separate stores. Replayed tokens are rejected after a claim is recorded.
- Netlify Blobs does not provide conditional create/CAS writes. Sequential replays are rejected, but simultaneous redemption requests may race; strict concurrency-safe single-use requires an atomic claim service.
- Admin can revoke grants, including permanent access. Guest session and PDF endpoint requests re-check the grant and revocation state.

## Web Catalog transfer

Set `PDF_CATALOG_TRANSFER_SECRET` in the Home Netlify functions environment to a dedicated, cryptographically random value of at least 32 UTF-8 bytes. Configure the same value only in the Web Catalog backend; do not expose it to browser code. For example, generate a random 32-byte value and encode it as base64url.

An authenticated guest may explicitly select **Switch to Web Mode**. The Home function validates the existing session and active grant, then returns an HS256 JWT in a no-store response. Navigation places it only in the Web Catalog URL fragment as `pdf_transfer`; it contains `customerEmail`, `sharedBy`, `source` (`pdf_catalog_share`), `iat`, `exp`, and `jti`, plus `iss` (`https://primelinedist.com`) and `aud` (`https://catalog.primelinedist.com`). Timestamps are Unix seconds. The expiration is at most five minutes after issuance and never later than the grant expiration.

The centered Catalog Mode tab is available after staff or guest access is verified. Staff navigate directly to Web Catalog, while guests use the transfer described above. The information button opens the explanation for touch and keyboard users.

Web Catalog must remove the fragment before loading analytics or third-party scripts and verify the HS256 signature, issuer, audience, source, timestamps, and customer email on its backend before using the data. A signed JWT is readable by its holder and is a bearer credential; it is not encrypted or single-use. Verification must not treat it alone as proof of email ownership, and an already issued credential cannot reflect subsequent PDF grant revocation without an additional server-side check. The Web Catalog receiver and Express Pass integration are not implemented here; coordinate activation with the receiver so the fragment is handled safely.

## Important public-PDF limitation

The existing PDF remains publicly accessible independently of Magic Link permissions. Magic Links control the Prime Line guest viewer and its access session; they do not protect the underlying PDF URL. The guest page does not display Prime Line Download PDF or Share Catalog actions, but this does not prevent someone from downloading, copying, or sharing the public PDF or its URL. The browser's built-in PDF controls may also be available.

The Magic Link is a bearer credential: forwarding it can transfer access to whoever redeems it first; it does not prove the recipient's identity.
