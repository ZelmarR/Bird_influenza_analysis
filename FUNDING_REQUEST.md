# Hosting Setup — Avian Field Research Platform

## Overview

This document provides everything needed to purchase and configure the infrastructure for the Bird Counter web application. The platform supports avian influenza surveillance by enabling researchers to upload field videos and automatically detect and count birds using computer vision. It is designed for fewer than 50 users.

**Total cost: ~$132/year (~$11/month)**

All steps below can be completed by the purchaser directly. The developer (Vaishnavi) will handle all technical configuration once accounts and purchases are in place.

---

## Cost Summary

| Service | Cost | Billed |
|---------|------|--------|
| Railway (backend server) | ~$10/month | Monthly, credit card |
| Domain name | ~$12 | Once per year |
| Vercel (frontend) | Free | — |
| Cloudflare (DNS + security) | Free | — |
| GitHub (code + data storage) | Free | — |

---

## Step 1 — Railway (Backend Server)
**Cost: ~$10/month**
**Link: https://railway.app**

Railway runs the Python server that powers video processing, user authentication, and all application logic. This is the only paid compute resource.

**How to purchase:**
1. Go to https://railway.app and click **"Start a New Project"**
2. Sign up with a Google or GitHub account
3. Once inside, click your profile icon (top right) → **"Billing"**
4. Click **"Upgrade to Hobby Plan"** — $5/month base, usage adds ~$5/month for this app
5. Enter a credit card — billing is monthly, cancel anytime
6. Send Vaishnavi the Railway account login credentials (or add her as a team member via Settings → Members)

**What Vaishnavi will do with this account:**
Deploy the backend server, configure all environment variables, and connect it to the domain.

---

## Step 2 — Domain Name
**Cost: ~$12/year**
**Link: https://www.namecheap.com**

A domain gives the application a professional public URL (e.g. `birdcounter.com`) instead of a generic hosting URL.



**How to purchase:**
1. Go to https://www.namecheap.com
2. Search for a domain name (suggested options below)
3. Add to cart and check out — requires an email address and credit card
4. After purchase, share the Namecheap account login with Vaishnavi so she can configure DNS settings

**Suggested domain names** (search on Namecheap to check availability and price):
- WildBirdActivityMonitor.com


Choose whichever is available and under $15/year. `.com` is preferred.

---

## Step 3 — GitHub Account (if not already available)
**Cost: Free**
**Link: https://github.com**

GitHub stores the application's source code and bird count result data (as CSV files). Two things are needed:

**3a. A GitHub account** (if the purchaser does not already have one):
1. Go to https://github.com and click **"Sign up"**
2. Use an institutional or personal email
3. Free plan is sufficient

**3b. A private data repository:**
1. Once logged in, click the **"+"** icon (top right) → **"New repository"**
2. Name it exactly: `bird-counter-data`
3. Set visibility to **Private**
4. Check **"Add a README file"**
5. Click **"Create repository"**

**3c. A Personal Access Token (so the server can read/write data):**
1. Go to GitHub → click profile photo → **Settings**
2. Scroll to the bottom of the left sidebar → **"Developer settings"**
3. Click **"Personal access tokens"** → **"Fine-grained tokens"**
4. Click **"Generate new token"**
5. Fill in:
   - Token name: `bird-counter-backend`
   - Expiration: 1 year
   - Repository access: select **Only select repositories** → choose `bird-counter-data`
   - Under Permissions → Repository permissions → **Contents: Read and write**
6. Click **"Generate token"**
7. **Copy the token immediately** — it is only shown once
8. Send the token securely to Vaishnavi (e.g. via encrypted email or in person)

---

## Step 4 — Vercel (Frontend Hosting)
**Cost: Free**
**Link: https://vercel.com**

Vercel hosts the user-facing web interface (the React application).

**How to set up:**
1. Go to https://vercel.com and click **"Sign Up"**
2. Sign up with the same GitHub account used in Step 3
3. That's it — Vaishnavi will connect the repository and configure the deployment

No credit card required.

---

## Step 5 — Cloudflare (DNS + Security)
**Cost: Free**
**Link: https://www.cloudflare.com**

Cloudflare sits in front of the domain and provides HTTPS encryption, DDoS protection, and global content delivery at no cost.

**How to set up:**
1. Go to https://www.cloudflare.com and click **"Sign Up"**
2. Create a free account with an email and password
3. That's it — Vaishnavi will add the domain and configure DNS after the domain is purchased

No credit card required.

---

## Summary of Actions Required

| Action | Who | Link |
|--------|-----|------|
| Create Railway account + upgrade to Hobby Plan | Purchaser | https://railway.app |
| Purchase domain name | Purchaser | https://www.namecheap.com |
| Create GitHub account + `bird-counter-data` repo + access token | Purchaser | https://github.com |
| Create Vercel account (free) | Purchaser | https://vercel.com |
| Create Cloudflare account (free) | Purchaser | https://www.cloudflare.com |
| All technical configuration and deployment | Vaishnavi | — |

Once the accounts are created and credentials are shared with Vaishnavi, full deployment can be completed within a few hours.

---

## Security Note

All credentials (Railway login, GitHub token, domain registrar login) should be shared securely — in person or via an encrypted channel. The application uses HTTPS, JWT-based authentication, and rate limiting. No sensitive research data is stored on any third-party server; only bird count summaries are stored in the private GitHub repository.
