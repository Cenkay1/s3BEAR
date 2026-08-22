# Security Policy

## Supported Versions

Security updates are currently provided for the latest stable release of s3BEAR.

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| Older   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in s3BEAR, please do not create a public GitHub Issue or Discussion.

Instead, report the vulnerability privately through GitHub's Security Advisories or by contacting the project maintainer.

When reporting a vulnerability, please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected versions
- Potential impact
- Any proof-of-concept, if available
- Suggested mitigation, if known

## Responsible Disclosure

Please allow reasonable time for the vulnerability to be investigated and addressed before publicly disclosing the issue.

We will work with the reporter to understand the issue, develop a fix, and coordinate disclosure when appropriate.

## Response Timeline

We aim to:

- Acknowledge vulnerability reports within 3 business days
- Assess the severity and impact as soon as possible
- Provide updates during the remediation process
- Release a fix or mitigation when appropriate

## Security Scope

Security reports related to the following areas are especially important:

- Authentication and authorization
- Azure Entra ID integration
- RBAC and access control
- S3 object access
- Signed or expiring URLs
- Image proxying
- API security
- Credential and secret handling
- SSRF
- Path traversal
- Privilege escalation
- Kubernetes and Helm deployment security
- Sensitive data exposure

## Out of Scope

The following are generally outside the scope of the security policy:

- Vulnerabilities in third-party dependencies that cannot be reproduced in s3BEAR
- Issues requiring physical access to the infrastructure
- Social engineering attacks
- Denial-of-service attacks against public infrastructure
- Issues caused solely by insecure deployment configuration

## Security Advisories

Confirmed vulnerabilities may be disclosed through GitHub Security Advisories after a fix or mitigation is available.

Thank you for helping keep s3BEAR and its users secure.
