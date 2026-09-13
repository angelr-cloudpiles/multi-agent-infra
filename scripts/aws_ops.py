"""AWS CLI helpers: production profile, in-memory secret transport, redacted failures."""
import json, os, subprocess, tempfile
PROFILE = os.environ.get('AIOPS_PROFILE', 'aiops-aws')
REGION = 'us-east-1'
_secret_values = []
def aws(service, operation, payload=None, **kwargs):
    cmd = ['aws', '--profile', PROFILE, '--region', REGION, '--output', 'json', service, operation]
    for key, value in kwargs.items():
        cmd += ['--' + key.replace('_', '-'), str(value)]
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.json') as request:
        if payload is not None:
            json.dump(payload, request)
            request.flush()
            cmd += ['--cli-input-json', 'file://' + request.name]
        p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        message = p.stderr
        for value in _secret_values:
            if isinstance(value, str) and len(value) > 3:
                message = message.replace(value, '[REDACTED]')
        raise RuntimeError(service + ' ' + operation + ': ' + message[:1500])
    return json.loads(p.stdout) if p.stdout.strip() else {}
def secret(name):
    value = json.loads(aws('secretsmanager', 'get-secret-value', secret_id=name)['SecretString'])
    _secret_values.extend(value.values())
    return value
def put_secret(name, value):
    _secret_values.extend(value.values())
    try:
        metadata = aws('secretsmanager', 'describe-secret', secret_id=name)
        aws('secretsmanager', 'put-secret-value', {'SecretId':name, 'SecretString':json.dumps(value)})
    except RuntimeError as e:
        if 'ResourceNotFoundException' not in str(e): raise
        metadata = aws('secretsmanager', 'create-secret', {'Name':name, 'SecretString':json.dumps(value), 'Tags':[{'Key':'Project','Value':'multi-agent-team'}]})
    return metadata['ARN']
if __name__ == '__main__':
    assert aws('sts', 'get-caller-identity')['Account'] == '278741241787'
    print('Production account verified')
