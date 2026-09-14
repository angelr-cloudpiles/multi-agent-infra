import secrets
from urllib.parse import quote
from aws_ops import aws, secret, put_secret
assert aws('sts', 'get-caller-identity')['Account'] == '278741241787'
db = secret('multi-agent-db-credentials')
runtime = secret('multi-agent-langfuse-runtime')
runtime['database_url'] = 'postgresql://%s:%s@multi-agent-langfuse-db.ci9o0w8kwebo.us-east-1.rds.amazonaws.com:5432/langfuse?sslmode=require' % (quote(db['username'], safe=''), quote(db['password'], safe=''))
for key in ['nextauth_secret','salt']:
    runtime.setdefault(key, secrets.token_urlsafe(48))
runtime.setdefault('encryption_key', secrets.token_hex(32))
runtime['nextauth_url'] = 'https://langfuse.aiops.cloudpiles.net'
put_secret('multi-agent-langfuse-runtime', runtime)
try:
    clickhouse = secret('multi-agent-clickhouse-runtime')
except RuntimeError as e:
    if 'ResourceNotFoundException' not in str(e): raise
    clickhouse = {'password':secrets.token_urlsafe(48)}
put_secret('multi-agent-clickhouse-runtime', clickhouse)
print('Langfuse and ClickHouse runtime secrets prepared; values suppressed')
