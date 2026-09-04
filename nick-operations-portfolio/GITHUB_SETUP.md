# Put Northstar Ops live on GitHub Pages

## One-time setup

1. Create a GitHub account at https://github.com/signup if Nick does not already have one.
2. In GitHub, choose **New repository**.
3. Name it `northstar-ops` for a project site, or use `<username>.github.io` if this should become Nick's main portfolio home.
4. Choose **Public** if using GitHub Free and the site should be publicly shareable.
5. Upload every file and folder from this package. Keep the `.github` folder and its `workflows/pages.yml` file.
6. Make sure the default branch is named `main`.
7. Open **Settings > Pages** in the repository.
8. Under **Build and deployment**, choose **GitHub Actions**.
9. Open the **Actions** tab and wait for **Publish Northstar Ops** to finish.

GitHub will show the live address in the deployment summary. For a project repository, it normally follows this pattern:

`https://<username>.github.io/northstar-ops/`

The clean portfolio presentation opens with:

`https://<username>.github.io/northstar-ops/?view=portfolio&mode=portfolio`

## Before sharing

- Replace the starter project text with Nick's reviewed examples.
- Remove any confidential operations details.
- Confirm every name, due date, and outcome is safe to publish.
- Test the site on a phone and in a private browser window.

## Team-use upgrade

GitHub Pages serves public static files. It does not provide a shared database or secure team accounts. Before Eddie and the Ops team use this for live confidential work, add:

- Sign-in and role-based access
- Shared database
- Change history and backups
- Private operations area separated from the public portfolio
- Notifications for owners and due dates

The current version is best used as a portfolio demonstration, meeting companion, or single-device operating tool.
