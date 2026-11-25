# Catalog Guest Access

Guest and staff catalog views use the existing public Autumn 2026 PDF:

`https://fcdrjlzqrbvnbsehkqgm.supabase.co/storage/v1/object/public/PDF%20Catalog/Autumn%202026.pdf`

No private bucket or storage setup is required. The guest PDF endpoint checks the active guest session and then returns this public URL. Staff download still requires an authorized employee catalog session. Web-to-PDF staff transfers additionally require the server-side Supabase credentials described below.

## Invitations, sessions, and revocation

- Magic Links use URL fragments so ordinary page requests and referrers do not transmit the token. A GET only loads the confirmation page; redemption happens after the customer explicitly confirms.
- Invitations expire after 30 days unused. Customer access starts when redeemed and supports 24 hours, 7 days, 1 month, 3 months, or permanent access. The invitation can be reused on up to three devices while the grant is active.
- The customer receives the access link. The verified inviting employee and Super Admin receive internal copies that identify the employee, customer, and access duration without including the access link. If an internal copy fails, customer access remains active and the sharing page reports the partial notification failure.
- Renewal verification links expire after 15 minutes and do not extend the grant. Browser sessions last at most seven days and never outlive a finite grant.
- The browser first receives a secure, HttpOnly device cookie before a redemption can reserve a device. A session is prepared before the grant is updated, and grant writes use conditional updates to enforce the three-device limit under concurrency. If the browser loses its cookie, it cannot recover its old device identity.
- Verification links are consumed in the same conditional grant update that authorizes the device; a device-limit rejection or session creation failure does not consume them. Expired verification claims are pruned on later verification attempts. If a response is lost after authorization, the same browser can reopen the guest page using its device cookie.
- Super Admin can explicitly reset the devices on an active grant. The reset preserves its original expiration and inviter, invalidates previous guest sessions, and stores the administrator, time, and previous device count on the grant. The guest can reopen the original invitation or request a fresh verification link. Expired or revoked grants cannot be reset.
- Admin can revoke grants, including permanent access. Guest session and PDF endpoint requests re-check the grant, device version, and revocation state. The separate Web-to-PDF transfer claim uses an atomic conditional create and does not add devices.

## Web Catalog transfer

Set `PDF_CATALOG_TRANSFER_SECRET` in the Home Netlify functions environment to a dedicated, cryptographically random value of at least 32 UTF-8 bytes. Configure the same value only in the Web Catalog backend; do not expose it to browser code. For example, generate a random 32-byte value and encode it as base64url.

An authenticated guest may explicitly select **View as Web Catalog**. The Home function validates the existing session and active grant, then returns an HS256 JWT in a no-store response. Navigation places it only in the Web Catalog URL fragment as `pdf_transfer`; it contains `customerEmail`, `sharedBy`, `source` (`pdf_catalog_share`), `iat`, `exp`, and `jti`, plus `iss` (`https://primelinedist.com`) and `aud` (`https://catalog.primelinedist.com`). Timestamps are Unix seconds. The expiration is at most five minutes after issuance and never later than the grant expiration.

The Catalog Mode button in the header is available after staff or guest access is verified. Staff navigate directly to Web Catalog, while guests use the transfer described above. Hover or focus reveals the explanation; on touch devices, press and hold the button to show it without navigating.

Web Catalog must remove the fragment before loading analytics or third-party scripts and verify the HS256 signature, issuer, audience, source, timestamps, and customer email on its backend before using the data. A signed JWT is readable by its holder and is a bearer credential; it is not encrypted or single-use. Verification must not treat it alone as proof of email ownership, and an already issued credential cannot reflect subsequent PDF grant revocation without an additional server-side check.

## Web Catalog to PDF

The Web Catalog backend issues a separate HS256 credential with `iss` `https://catalog.primelinedist.com`, `aud` `https://primelinedist.com/.netlify/functions/catalog-web-transfer`, `source` `web_catalog_mode`, identity claims, `iat`, `exp`, and a unique `jti`. Its lifetime is at most 120 seconds. Home removes `#web_transfer` before loading external resources and posts the credential to the transfer function. Home atomically claims the hashed `jti` in the `prime-line-web-transfer-claims` Blobs store; a daily scheduled function removes claims only after expiration plus a safety margin.

For staff, configure these **server-only Netlify Functions** environment variables manually:

- `PDF_CATALOG_TRANSFER_SECRET`: the same dedicated secret configured in the Web Catalog backend.
- `WEB_CATALOG_SUPABASE_URL`: the URL of the Web Catalog Supabase project.
- `WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY`: that project's service-role key. It has broad privileges; never expose it to browsers or commit it.

Home checks the Supabase Auth user and matching active `staff` record before issuing a staff session, then rechecks them for the viewer, downloads, and sharing. Existing OTP sessions keep their existing behavior. For customers, Home requires an active matching PDF grant and a previously registered device cookie; it reuses or creates a guest session without modifying the grant. A new device must use the existing invitation redemption process. Grant expiration and revocation continue to apply.

`@netlify/blobs` 11 requires Node.js 22.12 or newer. Manually confirm the Netlify build and Functions runtime use a compatible version before deploying. The Web Catalog transfer issuer and its secret must also be configured and deployed manually by the user; no Supabase schema or configuration changes are made here. Scheduled cleanup runs on production deploys.

## Important public-PDF limitation

The existing PDF remains publicly accessible independently of Magic Link permissions. Magic Links control the Prime Line guest viewer and its access session; they do not protect the underlying PDF URL. The guest page does not display Prime Line Download PDF or Share Catalog actions, but this does not prevent someone from downloading, copying, or sharing the public PDF or its URL. The browser's built-in PDF controls may also be available.

The Magic Link is a bearer credential: forwarding it can transfer access to whoever redeems it first; it does not prove the recipient's identity.
