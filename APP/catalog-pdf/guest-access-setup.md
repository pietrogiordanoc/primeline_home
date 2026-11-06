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

## Important public-PDF limitation

The existing PDF remains publicly accessible independently of Magic Link permissions. Magic Links control the Prime Line guest viewer and its access session; they do not protect the underlying PDF URL. The guest page does not display Prime Line Download PDF or Share Catalog actions, but this does not prevent someone from downloading, copying, or sharing the public PDF or its URL. The browser's built-in PDF controls may also be available.

The Magic Link is a bearer credential: forwarding it can transfer access to whoever redeems it first; it does not prove the recipient's identity.
