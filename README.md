# LANDSCOUT

Orange County affordable housing site explorer. This repository includes the website from source revision `a2fbf64`, the property popup with district-specific legal screening, and the 30-second LANDSCOUT film in `media/LANDSCOUT_30s_Preview.mp4`.

## Run locally

From the repository root, run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. On Windows, use `py` if your Python installation uses the Python Launcher. HTML, CSS, JavaScript modules, data and map assets are in `dist/`. Serve this directory at the domain root because the application uses root-relative asset URLs.

## Move to GitHub

Create an empty repository in your own account or organisation. Extract this package and open a terminal in the directory containing this README. With your normal GitHub authentication configured, run the following commands, replacing OWNER and REPO with your destination.

```sh
git init -b main
git add .
git commit -m "Import LANDSCOUT site and deployment settings"
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

If a teammate already created a repository with commits, clone it first and copy these files onto a new branch for review. The ZIP contains an editable source snapshot. Existing hosting and GitHub have independent deployment histories.

## Deploy on Vercel

Import the GitHub repository as a project. Select the directory containing `vercel.json` as the project root and deploy. The included configuration selects the Other preset, skips installation and building, and serves `dist/`. The film stays in the repository for sharing.

## Deploy on Railway

Choose **Deploy from GitHub repo** and select the repository. Use the repository root. Railway detects the Dockerfile and serves `dist/` through Caddy on the assigned `PORT`. After deployment, open **Settings → Networking → Generate Domain**. For a local container check, run:

```sh
docker build -t landscout .
docker run --rm -p 8080:8080 -e PORT=8080 landscout
```

## Maps and data

The basic map runs without a Cesium ion token. To use optional ion terrain or photorealistic tiles, allow the new origin on your public read-only Cesium token and enter it in Map settings. The current app keeps that entry in the browser tab. External services such as Photon and live imagery depend on provider availability. Preserve the source attributions in the map and listing views.

The zoning, property and legal screening records are bundled snapshots. The Google Sheets links open the research workbook subject to its existing permissions. Live workbook synchronisation would require a separate backend.

## Check the deployment

Open the county overview, select a city, and open a green commercial listing. In the centred popup, check the district-law sources. For 520 W Santa Ana Blvd, also check the photos and the illustrative capacity. Switch to 3D or Orbit and confirm the coloured city overlay disappears. Verify that the browser loads scripts, data, imagery and Cesium workers from the new origin.
