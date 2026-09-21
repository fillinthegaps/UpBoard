# Up Board — self-hosted on Vercel

This is the same Up Board app, restructured to run on your own free Vercel
project instead of a Claude artifact. Anyone with the link can use it —
no Claude sign-in of any kind required.

## What's in here

- `public/index.html` — the whole app (unchanged from before, just pointed
  at your own backend instead of Claude's).
- `api/state.js` — a small serverless function that reads/writes the shared
  rotation data (rosters, logs, samples) using Vercel KV.
- `api/ai.js` — a small serverless function that proxies "Draft reminder",
  "Ask the board", and "Weekly summary" to Anthropic's API, so your API key
  stays on the server and is never exposed in the browser.

## One-time setup (about 15 minutes)

### 1. Put this folder in a GitHub repository
Vercel deploys from a Git repository. If you don't already have a GitHub
account, create one free at github.com, then create a new repository (any
name, e.g. `up-board`) and upload every file in this folder to it — GitHub's
web interface lets you drag and drop files in, no command line needed.

### 2. Create a free Vercel account and import the repo
Go to vercel.com, sign up free (you can sign up directly with your GitHub
account, which makes step 3 automatic), click **Add New → Project**, and
select the repository you just created. Leave all the build settings on
their defaults and click **Deploy**. It'll fail on the first try — that's
expected, because the database isn't connected yet. Continue to step 3.

### 3. Add Vercel KV (the shared database)
In your new project on vercel.com, go to the **Storage** tab, click
**Create Database**, choose **KV**, and follow the prompts to create it and
connect it to this project. This automatically adds the environment
variables the `@vercel/kv` package needs — you don't have to configure
anything yourself.

### 4. Add your Anthropic API key (only needed for the AI features)
"Draft reminder," "Ask the board," and "Weekly summary" call Anthropic's
API directly, which is billed separately from your regular claude.ai
subscription (pay-as-you-go, by usage). If you want those three features:

1. Go to console.anthropic.com, sign up if needed, and create an API key
   under **API Keys**. You'll need to add a small amount of billing credit
   there (a few dollars covers a very long time at this app's usage level —
   each draft or summary costs a small fraction of a cent).
2. Back in your Vercel project, go to **Settings → Environment Variables**,
   add one named `ANTHROPIC_API_KEY` with that key as the value, and save.

If you'd rather skip this, just don't set the key — the rest of the app
works fine, those three buttons will just show an error if tapped.

### 5. Redeploy
Back on the project's **Deployments** tab, click the ⋯ menu on the latest
deployment and choose **Redeploy**. This time it'll succeed now that the
database (and optionally the API key) are connected.

### 6. Get your link
Vercel gives you a URL like `up-board-yourname.vercel.app` — that's your
permanent link. Share that with every rep. Anyone who opens it can use the
board immediately; there's no sign-in step at all.

## Ongoing costs

- **Vercel Hobby plan**: free, covers this app's traffic many times over.
- **Vercel KV**: free tier (256 MB storage, generous request limits) —
  won't be approached at two-location showroom scale.
- **Anthropic API** (only if you enabled the AI features): pay-as-you-go,
  realistically a few cents to a couple of dollars a month depending on how
  often reps use "Draft reminder" and managers use "Ask the board."

So: **$0/month** with the AI features off, or **a few dollars a month at
most** with them on.

## Making future changes

Any time you want a feature added or a bug fixed, the same workflow
applies: update the files in your GitHub repository (I can hand you the
updated files each time, the same way I have been), and Vercel
automatically redeploys within about a minute of the change landing in the
repo — no manual redeploy step needed after the first one.
