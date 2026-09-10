# Contributing to Multi-Agent Infrastructure

Thank you for your interest in contributing!

## How to Contribute

### Reporting Issues

1. Check existing issues first
2. Use the issue template
3. Provide detailed information:
   - Environment (OS, Terraform version, AWS CLI version)
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs and screenshots

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and validation:
   ```bash
   terraform fmt
   terraform validate
   terraform plan
   ```
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **Terraform**: Follow HashiCorp best practices
- **Naming**: Use consistent naming conventions
- **Tags**: All resources must have required tags
- **Documentation**: Update docs for any changes

### Required Tags

All resources must include:
```hcl
tags = {
  Project     = "multi-agent-team"
  Environment = "production"
  Owner       = "aiops"
  CostCenter  = "aiops-operations"
  ManagedBy   = "terraform"
}
```

### Testing

Before submitting PR:
1. Run `terraform fmt -recursive`
2. Run `terraform validate`
3. Run `terraform plan` and review changes
4. Test in development environment first

### Security

- Never commit secrets or credentials
- Use AWS Secrets Manager for sensitive data
- Follow principle of least privilege
- Report security issues privately

## Questions?

Email: aiops@cloudpiles.com
