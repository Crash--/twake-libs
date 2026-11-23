# Publishing a new package to npm

The packages of this monorepo are published by the `Publish` job of
`.github/workflows/ci-cd.yml` with npm **trusted publishing** (OIDC). There is
no npm token in the workflow: npm trusts the GitHub Actions run itself. That
trust is configured **per package** on npmjs.com, so every new package needs a
one-time setup before CI can publish it.

Without it, the release of the new package fails in `verifyConditions` with:

```text
[@linagora/<name>] › ✘  ENONPMTOKEN No npm token specified.
```

The other packages are still released; only the new one is skipped.

## Who can do it

Someone who is a member of the `linagora` npm organization, in the `admin` team
(that team gives write access to the `@linagora/twake-*` packages), with 2FA
enabled on their npm account. npm asks for the second factor again on each
change below.

## 1. Prepare the package

In `packages/<name>/package.json`:

```json
{
  "name": "@linagora/<name>",
  "version": "0.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/linagora/twake-libs.git",
    "directory": "packages/<name>"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "files": ["dist", "CHANGELOG.md", "README.md"]
}
```

`repository.url` must point to `linagora/twake-libs`: npm checks it against the
repository of the OIDC token and refuses the provenance otherwise.

## 2. Make sure the package exists on npm

A trusted publisher can only be added to a package that already exists. Check:

```bash
npm view @linagora/<name> version
```

If it answers `E404`, publish a first version by hand from your machine (you
need write access to the `@linagora` scope):

```bash
cd packages/<name>
npm run build
npm publish --access public --tag bootstrap
```

Use a version that semantic-release will never produce, or deprecate it right
after. Do **not** run `npm run release` locally.

## 3. Give the `admin` team write access

The package settings, trusted publisher included, are only shown to accounts
with write access to the package. A package published from another account or
another repository is often not in the `admin` team: its `/access` page then
answers `{"message":"Not Found"}` and the **Settings** tab is missing.

An **owner** or **admin** of the `linagora` organization (a plain member cannot)
opens `https://www.npmjs.com/settings/linagora/teams/team/admin/access`, types
the package name, **picks it in the suggestion list** (the button does nothing
otherwise), clicks **+ Add Existing Package** and keeps **Read and write**.

Check it:

```bash
curl -s "https://registry.npmjs.org/-/package/@linagora%2f<name>/collaborators"
```

If the page still answers `Not Found` while your account is listed, sign out of
npmjs.com and back in: the session keeps the old permissions.

## 4. Add the trusted publisher

On `https://www.npmjs.com/package/@linagora/<name>/access`, in
**Trusted Publisher**, choose **GitHub Actions** and fill in:

| Field                | Value        |
| -------------------- | ------------ |
| Organization or user | `linagora`   |
| Repository           | `twake-libs` |
| Workflow filename    | `ci-cd.yml`  |
| Environment name     | `npm`        |

Check **Allow npm publish**, leave **Allow npm dist-tag** unchecked, then save.
The connection shows **Pending validation** until the first publication through
it.

All four values must match exactly. The environment name is lowercase `npm`, the
GitHub environment the `Publish` job runs in (it is limited to `main`).

## 5. Disallow tokens

On the same page, in **Publishing access**, select **Require two-factor
authentication and disallow tokens**, then save. Trusted publishing keeps
working, and no leaked token can publish the package any more.

## 6. Release

Re-run the failed `Publish` job, or merge the next change. semantic-release
releases the package from its commits: with no `@linagora/<name>@*` tag yet,
the first release is `1.0.0` when the history holds a `feat` commit.

Check that the version was published through OIDC: `_npmUser` must be
`GitHub Actions`, with a `trustedPublisher` entry.

```bash
npm view @linagora/<name> --json | jq '._npmUser'
```
