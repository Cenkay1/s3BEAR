# Contributing to s3BEAR

Thank you for your interest in contributing to s3BEAR.

s3BEAR is an open-source S3 gateway designed for secure object access and AI workloads. Contributions of all kinds are welcome, including bug fixes, new features, documentation improvements, tests, and performance improvements.

## Getting Started

1. Fork the repository.

2. Clone your fork:

    ```bash
    git clone https://github.com/Cenkay1/s3BEAR.git
    cd s3BEAR
    ```

3. Create a new branch:

    ```bash
    git checkout -b feature/my-feature
    ```

4. Make your changes.

5. Run the relevant tests and checks.

6. Commit your changes:

    ```bash
    git add .
    git commit -m "feat: add my feature"
    ```

7. Push your branch:

    ```bash
    git push origin feature/my-feature
    ```

8. Open a Pull Request against the `main` branch.

## Branch Naming

Please use descriptive branch names.

Examples:

- `feature/add-ceph-support`
- `feature/add-object-preview`
- `fix/image-proxy-authentication`
- `fix/permission-check`
- `docs/update-installation-guide`
- `refactor/storage-service`

## Pull Requests

Before opening a Pull Request, please make sure that:

- The code follows the existing project structure and style.
- Existing functionality is not unnecessarily broken.
- New functionality includes appropriate tests where applicable.
- Documentation is updated when necessary.
- No secrets, credentials, API keys, tokens, or private configuration files are committed.
- The Pull Request description clearly explains the changes.
- The changes are focused and do not include unrelated modifications.

## Commit Messages

Use clear and descriptive commit messages.

We recommend using conventional commit prefixes such as:

```text
feat: add new storage provider
fix: prevent unauthorized object access
docs: improve Helm installation guide
refactor: simplify S3 client handling
test: add permission tests
chore: update dependencies
```

Bug Reports

Before reporting a bug, please search existing Issues to make sure the problem has not already been reported.

A useful bug report should include:

s3BEAR version or commit
Deployment method
Storage backend
Operating system, if relevant
Kubernetes version, if applicable
Steps to reproduce
Expected behavior
Actual behavior
Relevant logs or error messages

Please remove sensitive information before sharing logs or configuration files.

This includes:

Access keys
Secret keys
Passwords
API tokens
Authentication cookies
Private URLs
Personal information
Feature Requests

Feature requests are welcome.

When requesting a feature, please explain:

What problem the feature would solve
Why it would be useful
How you expect the feature to work
Any alternative solutions you considered

Feature requests related to S3, object storage, security, Kubernetes, AI/LLM workloads, and developer experience are especially welcome.

Documentation

Documentation improvements are also valuable contributions.

You can contribute by:

Fixing incorrect information
Improving installation instructions
Adding configuration examples
Adding deployment examples
Improving API documentation
Adding troubleshooting information
Fixing spelling or grammar issues
Testing

Please test your changes before submitting a Pull Request.

Depending on the change, this may include:

Unit tests
Integration tests
API tests
Authentication and authorization tests
S3 compatibility tests
Docker-based tests
Kubernetes and Helm deployment tests

If your change cannot be fully tested locally, please mention this in the Pull Request.

Security

Security vulnerabilities should not be reported through public GitHub Issues or Discussions.

Please follow the instructions in SECURITY.md for reporting security vulnerabilities.

Do not disclose security vulnerabilities publicly until they have been investigated and, where appropriate, fixed.

Code of Conduct

Please be respectful and constructive when participating in the s3BEAR community.

Harassment, discrimination, personal attacks, or intentionally disruptive behavior are not welcome.

We want s3BEAR to be a welcoming project for developers with different backgrounds and levels of experience.

License

By contributing to s3BEAR, you agree that your contributions will be licensed under the same license as the project.

Questions

If you are unsure about something before starting a contribution, feel free to open a GitHub Discussion and ask.

We appreciate all contributions, whether they are large features, small bug fixes, documentation improvements, or helpful feedback.

Thank you for helping improve s3BEAR.
