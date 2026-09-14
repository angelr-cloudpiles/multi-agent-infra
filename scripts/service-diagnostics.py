import re,sys,time,json
from aws_ops import aws
names=sys.argv[1:] or ['langfuse','langfuse-worker','clickhouse']
def scrub(s):
 s=re.sub(r'(postgres(?:ql)?|redis|https?)://[^\s/@]+:[^\s/@]+@',r'\1://[REDACTED]@',s)
 s=re.sub(r'(?i)((?:password|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;}]+',r'\1[REDACTED]',s)
 return s
for n in names:
 arns=aws('ecs','list-tasks',{'cluster':'multi-agent-platform','serviceName':'multi-agent-'+n,'desiredStatus':'STOPPED'})['taskArns']
 if arns:
  for t in aws('ecs','describe-tasks',{'cluster':'multi-agent-platform','tasks':arns[-5:]})['tasks']:
   print(n,json.dumps({k:t.get(k) for k in ['taskArn','stoppedReason','stopCode']}))
 streams=aws('logs','describe-log-streams',{'logGroupName':'/aws/ecs/multi-agent-platform','logStreamNamePrefix':n+'/'+n+'/'}).get('logStreams',[])
 for stream in sorted(streams,key=lambda x:x.get('lastEventTimestamp',0),reverse=True)[:2]:
  logs=aws('logs','get-log-events',{'logGroupName':'/aws/ecs/multi-agent-platform','logStreamName':stream['logStreamName'],'limit':25,'startFromHead':False})
  for e in logs.get('events',[]):print(n,scrub(e['message'])[:1500])
