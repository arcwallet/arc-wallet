# Contributing to Arc Wallet

Thank you for your interest in contributing to Arc Wallet! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be respectful** and inclusive
- **Be collaborative** and constructive
- **Focus on what is best** for the community
- **Show empathy** towards other community members

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment details (browser, OS, version)

### Suggesting Features

Feature requests are welcome! Please:
- Check existing issues first
- Provide clear use cases
- Explain why this feature would be useful
- Consider implementation complexity

### Pull Requests

1. **Fork the repository** and create a new branch
2. **Make your changes** with clear, descriptive commits
3. **Test thoroughly** - ensure all tests pass
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

#### PR Guidelines

- One feature/fix per PR
- Follow existing code style
- Add tests for new features
- Update README if adding features
- Keep commits atomic and well-described

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/arc-wallet.git
cd arc-wallet

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev

# Run tests
npm test
npm run test:e2e
```

## Project Structure

```
arc-wallet/
├── components/       # React components
├── contexts/         # React contexts
├── services/         # API and service layers
├── config/           # Configuration files
├── contracts/        # Smart contracts
├── backend/          # Backend API server
└── tests/            # Test files
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Avoid `any` types when possible
- Document complex functions

### React
- Use functional components with hooks
- Keep components small and focused
- Use meaningful prop names

### Styling
- Use Tailwind CSS classes
- Follow existing design patterns
- Ensure responsive design

### Git Commits
Follow conventional commits:
```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc.
refactor: code restructuring
test: adding tests
chore: maintenance tasks
```

## Testing

- Write unit tests for utilities and services
- Write integration tests for components
- Write E2E tests for critical user flows
- Ensure all tests pass before submitting PR

## Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Update CHANGELOG.md for notable changes

## Review Process

1. **Automated checks** must pass (tests, linting)
2. **Code review** by maintainers
3. **Testing** in staging environment
4. **Approval** and merge

## Getting Help

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions
- **Issues**: Report bugs or request features

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to Arc Wallet! 🚀
