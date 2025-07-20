---
title: Contributing
---

# Contributing to SparkyFitness

We welcome contributions of all kinds! Whether you're fixing bugs, adding features, improving documentation, or helping other users, your contributions make SparkyFitness better for everyone.

## Quick Start

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/SparkyFitness.git
cd SparkyFitness

# Copy environment template
cp docker/.env.example .env

# Start development environment
./docker/docker-helper.sh dev up

# Access application at http://localhost:8080
```

## Types of Contributions

- **🐛 Bug Fixes** - Report issues and submit fixes
- **✨ New Features** - Propose and implement new functionality
- **📚 Documentation** - Improve guides, fix typos, add examples
- **🎨 UI/UX** - Enhance user experience and accessibility
- **🔧 Infrastructure** - Improve build, deployment, or development tools

## Before Contributing

1. **Join our community**: [Discord](https://discord.gg/vcnMT5cPEA) for discussions
2. **Read the developer guides** (linked below) to understand the architecture
3. **Check existing issues** to avoid duplicate work
4. **Start with "good first issue" labels** for your first contribution

## Developer Resources

For detailed technical information, see our comprehensive developer guides:

- **[Development Workflow](./developer/workflow)** - Architecture, patterns, coding standards, and testing
- **[Getting Started](./developer/getting-started)** - Complete setup guide with all installation options
- **[Docker Guide](./developer/docker)** - Container deployment, troubleshooting, and configuration

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following existing patterns
3. **Test thoroughly** using the development environment
4. **Submit a PR** with clear description of changes
5. **Respond to feedback** from reviewers

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help newcomers get started
- Focus on the code, not the person

## Documentation Contributions

### Quick Edits
Edit markdown files directly on GitHub - it will prompt you to fork and create a PR.

### Local Development
For major documentation changes:

```bash
cd docs
npm install
npm run dev
# Open http://localhost:3000
```

We use [Nuxt Content](https://content.nuxt.com/) + [Docus](https://docus.dev/) for documentation.

## Getting Help

- **💬 Discord**: [Join our community](https://discord.gg/vcnMT5cPEA)
- **📋 Discussions**: Ask questions on GitHub Discussions  
- **📚 Documentation**: Comprehensive guides in this docs site

Thank you for contributing to SparkyFitness! 🎉