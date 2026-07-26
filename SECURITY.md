# SentryMail Security Policy
 
**Document Version**: 1.0  
**Last Updated**: July 2026  
**Effective Date**: July 2026
 
---
 
## 1. Responsible Disclosure Policy
 
Security vulnerabilities can be reported confidentially to:
 
**Email**: security@sentrymail.de  
**Response Time**: Acknowledgment within 24 hours  
**Patch Timeline**: 30–90 days depending on severity

**PGP Key** — save to a file and import with `gpg --import`.
Fingerprint: `E76E B82D D51E 880D 2309 B471 9BD0 2E65 9361 A33B`
(the key carries the user ID `md@secure-bits.org`; it is the correct key for the address above).

```text
-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaZk+sRYJKwYBBAHaRw8BAQdAz6rf3rkWb8q7/r57zjh5/Go7QZcyaFJr
PqINvrsB2CjNJ21kQHNlY3VyZS1iaXRzLm9yZyA8bWRAc2VjdXJlLWJpdHMu
b3JnPsLAEQQTFgoAgwWCaZk+sQMLCQcJEJvQLmWTYaM7RRQAAAAAABwAIHNh
bHRAbm90YXRpb25zLm9wZW5wZ3Bqcy5vcmeYffm4trTJpD/QtOJtG0RFuOQv
CCFW2+Z6SPzsWsX4BwMVCggEFgACAQIZAQKbAwIeARYhBOduuC3VHogNIwm0
cZvQLmWTYaM7AAAM7QEAgWawGLnj3UmzXvsL8pTeezztbATbFVfbi5jCwKpI
YlIA/2ZqjYrh2L7oMl9hDc8abyZAy8h5Uj2fZ73bObb9oS0DzjgEaZk+sRIK
KwYBBAGXVQEFAQEHQFG6XfL81UcyC2e6/qc4CE2zTU0F1Mc17mggKtBgqicF
AwEIB8K+BBgWCgBwBYJpmT6xCRCb0C5lk2GjO0UUAAAAAAAcACBzYWx0QG5v
dGF0aW9ucy5vcGVucGdwanMub3JniTBqiyfH3Z5uiGodg2kyN4ru52vOzP+c
2S1GrT9dKZ0CmwwWIQTnbrgt1R6IDSMJtHGb0C5lk2GjOwAAK7cBALNxxnEn
XkvwX0GgjtXqXLhcadG+wWa+LBlO90F7PY/2AQCYycosKm8np5DdNE6m4J87
3LXcT4P3JXaiNwip/xy/Dw==
=Aetf
-----END PGP PUBLIC KEY BLOCK-----
```
 
### Vulnerability Severity Classification
 
| Severity | CVSS | Example | Patch Target |
|----------|------|---------|--------------|
| **CRITICAL** | 9.0–10.0 | Authentication bypass, RCE | 48 hours |
| **HIGH** | 7.0–8.9 | SQL injection, privilege escalation | 7 days |
| **MEDIUM** | 4.0–6.9 | XSS, CSRF, information disclosure | 30 days |
| **LOW** | 0.1–3.9 | Documentation errors, best practice violations | 90 days |
 
### Reporting Guidelines
 
1. **No public disclosures** before fix is released
2. **Proof-of-concept only when necessary**
3. **Coordinate with security@sentrymail.de** before public disclosure
4. **Acknowledgment in security advisories** (anonymous or attributed, your choice)
