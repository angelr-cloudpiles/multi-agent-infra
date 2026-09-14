#!/usr/bin/env python3
"""Exercise every AgentCore Harness with bounded, read-only prompts."""
import json
import pathlib
import uuid

import boto3
from botocore.config import Config

ROOT = pathlib.Path(__file__).resolve().parents[1]
HARNESS = json.loads((ROOT / "agentcore" / "deployed.json").read_text())
client = boto3.Session(profile_name="aiops-aws", region_name="us-east-1").client(
    "bedrock-agentcore", config=Config(retries={"max_attempts": 3, "mode": "adaptive"})
)

for agent, deployment in HARNESS.items():
    response = client.invoke_harness(
        harnessArn=deployment["arn"],
        runtimeSessionId=str(uuid.uuid4()),
        messages=[{"role": "user", "content": [{"text": "Reply with exactly: READY"}]}],
        maxIterations=2,
        maxTokens=64,
        timeoutSeconds=60,
    )
    output = ""
    failure = None
    for event in response["stream"]:
        if "contentBlockDelta" in event:
            output += event["contentBlockDelta"].get("delta", {}).get("text", "")
        for key in ("runtimeClientError", "validationException", "internalServerException"):
            if key in event:
                failure = key
    if failure or "READY" not in output.upper():
        raise RuntimeError(f"{agent}: verification failed ({failure or 'unexpected response'})")
    print(f"{agent}: PASS")
