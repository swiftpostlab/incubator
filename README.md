# @swiftpost/incubator

A place to try out small projects.

## Goals

Provide one deployed static site that hosts several small, independent experiments side by side, so
a new idea costs a route folder rather than a new repository. Each subproject lives under
`packages/main/src/app/<subproject>/` and is linked from the home page.

This repo is downstream of [swiftpost-site-template](https://github.com/swiftpostlab/swiftpost-site-template),
which supplies the baseline stack, tooling, and agent setup. Sync by rebasing onto it.

## Requirements and recommended

### GitHub account (if you want to use GitHub pages or clone this repository)

- [Create an account on GitHub](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github)

### Git (for local development)

You may choose to install Git on your machine, or use GitHub Desktop for a more convenient experience.

- [Set up Git](https://docs.github.com/en/get-started/git-basics/set-up-git)

### Node (for local development)

Node 22 or higher (available on path), using `nvm` is recommended but not required.

- [Windows node setup guide](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows)

## Getting Started on local

First, install the packages with `yarn`, then run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy on GitHub Pages

The CI of this project already contains the needed setup to deploy it on GitHub Pages.

## Known issues

### Issues with install

If while installing with `yarn` hangs and you get the following

```sh
info There appears to be trouble with your network connection. Retrying...
```

you might need to repeat the command with the flag `--network-timeout 100000`.

See more: <https://stackoverflow.com/a/51508426/2219492>

### Issues with your first deploy

However, for the first setup, you my need to follow [these additional steps](https://github.com/peaceiris/actions-gh-pages?tab=readme-ov-file#%EF%B8%8F-first-deployment-with-github_token).

### Issues with subpath (broken assets)

If your website is for a GitHub project, you may need to configure the base path in the `next.config.js` file.
For example, for this project it is `basePath: '/incubator'`.

---

## Learn More

### Elysium UI and Material UI

Elysium is a thin wrapper around Material UI, which is a popular UI library for building user interfaces. Material UI provides a
 wide range of components that you can use to build user interfaces.

To learn more about MUI, take a look at the following resources

- [MUI Learn](https://mui.com/material-ui/getting-started/learn/)
- [MUI Components](https://mui.com/material-ui/all-components/)

### Next

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

### Git and GitHub

- [About git and GitHub](https://docs.github.com/en/get-started/start-your-journey/about-github-and-git)
- [Create an account on GitHub](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github)

### Github Pages

GitHub provides a simple way to deploy your website on GitHub Pages and this repository is configured to do that.

To learn more about GitHub Pages, take a look at the following resources:

- [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) - learn about what GitHub Pages is and how it works
- [Interactive Tutorial](https://github.com/skills/github-pages) - an interactive tutorial that will help you understand the basics of GitHub Pages and deploy your website
- [Custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) - learn how to configure a custom domain for your GitHub Pages site

---

## TODO

- [ ] Create a minimal functioning blog template (header, footer, menu, main page, article pages, about, contact)
- [ ] Add markdown support in blog posts
- [ ] Create a setup script for easy adoption (e.g. set base path, set this repo as upstream)
- [ ] Sitemap generation, robots, SEO improvements
- [ ] Additional easy customization options (e.g. custom colors, fonts, etc.) without changing the theme
- [ ] Add documentation on how to use components and themes
- [ ] Add documentation on how to extend components and themes
- [ ] Add GA optional tracking, GDPR and cookie consent
- [ ] Add support for other languages
- [ ] Add gallery component
- [ ] Add carousel component
- [ ] Add FAP component
- [ ] Add payment option component with major 3rd party payment providers (e.g. PayPal, Stripe, Klarna)

## Contribute back

If you plan to contribute back to this project, please make a fork and read the following.

### Create a local branch called upstream that mirrors upstream/main

```sh
git checkout -b upstream upstream/main
git branch --set-upstream-to=upstream/main upstream
```

This creates a local upstream branch that mirrors the upstream/main branch.
​

### Keep your local upstream up-to-date

```sh
git fetch upstream
git checkout upstream
git reset --hard upstream/main
```

This keeps a local view of the upstream’s main branch; it’s not part of your fork.

### Create a feature branch for your changes

Always base your work on the local upstream branch so your changes start from the latest upstream main:

```sh
git checkout upstream
git checkout -b feature/my-change
This creates a new branch for your contribution based on the current upstream state.
```

### Cherry-pick the commits you want to contribute

If you already have commits in another branch (for example, in your fork’s main or some experimental branch), cherry-pick only the commits you want onto your feature branch:

```sh
# Inspect your existing branch to find commit hashes
git log <your-existing-branch>
# From feature/my-change, cherry-pick selected commits
git checkout feature/my-change
git cherry-pick <commit-hash-1> <commit-hash-2> ...
```

Resolve any conflicts during cherry-pick, then continue with:

```sh
git cherry-pick --continue
```

as needed.

### Push your branch and open a Pull Request

Push the feature branch to your fork:

```sh
git push -u origin feature/my-change
```

Then go to GitHub and create a Pull Request:

- Base repository: this project’s repo.
- Base branch: `main`.
- Head repository: your fork.
- Head branch: `feature/my-change`.

Describe your changes and submit the PR.

### Rules for direct pushes

Do **not** push directly to the upstream main branch.

All contributions must come through Pull Requests from forks or branches.
