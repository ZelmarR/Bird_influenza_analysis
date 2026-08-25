"""
One-time migration: copy results_A/B/C.csv from the old flat path in the GitHub
data repo to the per-user folder for vaish13281@gmail.com.

Run once from the backend directory:
    python migrate_data.py
"""

import os
import sys

from dotenv import load_dotenv
load_dotenv()

from github_utils import _fetch_file, _commit_file, _user_slug, RESULTS_COLUMNS

TARGET_EMAIL = "vaish13281@gmail.com"
LOCATIONS = ["A", "B", "C"]


def migrate():
    slug = _user_slug(TARGET_EMAIL)
    for loc in LOCATIONS:
        old_path = f"results_{loc}.csv"
        new_path = f"results/{slug}/results_{loc}.csv"

        print(f"Reading {old_path} ...", end=" ", flush=True)
        content, _ = _fetch_file(old_path)
        if not content:
            print("not found, skipping.")
            continue
        print(f"{len(content)} bytes")

        print(f"Writing to {new_path} ...", end=" ", flush=True)
        _, existing_sha = _fetch_file(new_path)
        _commit_file(
            new_path,
            content,
            existing_sha,
            f"Migrate results_{loc}.csv to user folder ({slug})",
        )
        print("done.")

    print("\nMigration complete.")
    print(f"Data is now at results/{slug}/results_{{A,B,C}}.csv")
    print("The old flat files (results_A.csv etc.) are still in the repo — you can delete them manually if desired.")


if __name__ == "__main__":
    missing = [v for v in ["GITHUB_TOKEN", "GITHUB_REPO"] if not os.environ.get(v)]
    if missing:
        print(f"Error: missing environment variables: {', '.join(missing)}")
        sys.exit(1)
    migrate()
