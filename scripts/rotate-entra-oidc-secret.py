#!/usr/bin/env python3
"""Rotate the Entra OIDC client secret without ever writing it to stdout or Git."""
import datetime as dt
import json
import os
import subprocess
import tempfile

PROFILE = "aiops-aws"
REGION = "us-east-1"
POOL = "us-east-1_HfqTm2uYI"
PROVIDER = "EntraID"
APP_ID = "1d92561c-b198-48eb-9c8c-410fda3c969d"
SECRET_NAME = "multi-agent-entra-id-oidc-client-secret"


def run(command, *, input_text=None):
    result = subprocess.run(command, input=input_text, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Command failed: " + " ".join(command[:4]))
    return result.stdout


def aws(*args):
    return run(["aws", "--profile", PROFILE, "--region", REGION, *args])


def secure_file(payload):
    handle = tempfile.NamedTemporaryFile(mode="w", delete=False)
    try:
        os.chmod(handle.name, 0o600)
        json.dump(payload, handle)
        handle.flush()
        return handle.name
    finally:
        handle.close()


def main():
    old = json.loads(run(["az", "ad", "app", "credential", "list", "--id", APP_ID, "-o", "json"]))
    expires = (dt.datetime.now(dt.UTC) + dt.timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
    created = json.loads(run([
        "az", "ad", "app", "credential", "reset", "--id", APP_ID, "--append",
        "--display-name", "multi-agent-cognito-rotation", "--end-date", expires, "-o", "json",
    ]))
    client_secret = created["password"]
    details = json.loads(aws(
        "cognito-idp", "describe-identity-provider", "--user-pool-id", POOL,
        "--provider-name", PROVIDER, "--query", "IdentityProvider.ProviderDetails", "--output", "json",
    ))
    details["client_secret"] = client_secret
    details_path = secret_path = None
    try:
        details_path = secure_file(details)
        secret_path = secure_file({"client_secret": client_secret})
        aws(
            "cognito-idp", "update-identity-provider", "--user-pool-id", POOL,
            "--provider-name", PROVIDER, "--provider-details", f"file://{details_path}",
        )
        aws("secretsmanager", "put-secret-value", "--secret-id", SECRET_NAME, "--secret-string", f"file://{secret_path}")
    except Exception:
        raise
    finally:
        client_secret = ""
        for path in (details_path, secret_path):
            if path and os.path.exists(path):
                os.remove(path)
    for credential in old:
        key_id = credential.get("keyId")
        if key_id:
            run(["az", "ad", "app", "credential", "delete", "--id", APP_ID, "--key-id", key_id])
    print("Entra OIDC credential rotated; prior credentials revoked; Cognito and Secrets Manager updated.")


if __name__ == "__main__":
    main()
