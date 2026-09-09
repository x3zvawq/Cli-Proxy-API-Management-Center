# QoL upstream workflow

This repository is a direct GitHub fork of router-for-me/Cli-Proxy-API-Management-Center. Its `main` branch contains our latest QoL integration, retaining the inherited Fwindy history and our custom commits. Git remotes are independent of GitHub's fork metadata.

Use the official repository directly for regular updates, and Fwindy as a selective source:

```sh
git remote add upstream https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git
git remote add fwindy https://github.com/Fwindy/Cli-Proxy-API-Management-Center.git
git fetch --no-tags upstream main
git fetch --no-tags fwindy main
```

Run the `remote add` commands only if those remotes do not already exist. `upstream/main` and `fwindy/main` preserve source history; our `main` contains our integration work. Updating remote refs alone does not change application code or deployments.

For an update, create a `codex/` integration branch from our current work, merge the chosen official revision, resolve conflicts, and inspect Fwindy's relevant commits separately. Use `git cherry-pick -x <reviewed-commit>` for an independent change after checking its dependencies. Do not blindly merge Fwindy's full branch: that can reintroduce its statistics client and undo QoL's paginated/aggregate API split.

Validate authentication, native configuration/credential routes, the QoL routes, four locales, and mobile layout with `bun run verify` and browser checks before deployment. Keep existing upstream attribution and licenses.

The direct official fork relationship was established separately when the repository was recreated. Adding or changing Git remotes does **not** reparent a GitHub fork.
