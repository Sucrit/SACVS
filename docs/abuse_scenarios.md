THIS LIST IS CREATED AS A GUIDE FOR DEVS ON ATTACK, ABUSE SURFACE IN THE SYSTEM.
NOTE: Do not use this document as your main 

Fake institution onboarding
- Fraudster registers as a school, gets approved, then issues fake “legit-looking” credentials to paying victims.

Compromised admin account abuse
- Attacker takes over an admin account, changes roles/statuses, then approves malicious entities or suspends real users.

Insider institution fraud
- A real institution operator creates fake student profiles and issues credentials to non-students.

QR first-scan hijack
- Student shares a one-time QR in an unsafe channel; scammer scans first and consumes token before intended employer.

QR document exfiltration
- Verifier with preview/download access copies and redistributes student documents without permission.

Public verify endpoint brute force
- Bots spam /credentials/verify/qr attempting token guessing, scraping, or service disruption.

Credential request spam/coercion
- Abusers create mass credential requests to pressure institutions or bury legitimate requests.

Privilege escalation chain
- Attacker first gets low-privilege account approved, then abuses weak controls to gain institution/admin privileges.

Internal endpoint misuse
- If internal service token is misconfigured, attacker calls internal routes (document retrieval/notification injection).

Malicious file uploads
- User uploads disguised payloads (malformed PDFs/images) to exploit preview/parsing workflows or host illegal content.

Reputation scam with real credentials
- Scammer obtains a real credential, then uses it in fake job/package scams to “prove” legitimacy.

Audit evasion behavior
- Abuser spreads actions across multiple accounts/services to make investigation difficult and reduce attribution clarity.