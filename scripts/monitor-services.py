import argparse,json,time,re
from aws_ops import aws
p=argparse.ArgumentParser();p.add_argument('--watch',type=int,default=0);p.add_argument('--services',nargs='+',default=['multi-agent-clickhouse','multi-agent-langfuse','multi-agent-langfuse-worker','multi-agent-agent-office']);args=p.parse_args()
end=time.monotonic()+args.watch
while True:
    services=aws('ecs','describe-services',{'cluster':'multi-agent-platform','services':args.services})
    for s in services['services']:
        print(json.dumps({'service':s['serviceName'],'running':s['runningCount'],'desired':s['desiredCount'],'pending':s['pendingCount'],'deployments':[{k:d.get(k) for k in ['status','rolloutState','failedTasks']} for d in s['deployments']],'event':s['events'][0]['message'] if s['events'] else ''}),flush=True)
        arns=aws('ecs','list-tasks',{'cluster':'multi-agent-platform','serviceName':s['serviceName']})['taskArns']
        if arns:
            ts=aws('ecs','describe-tasks',{'cluster':'multi-agent-platform','tasks':arns})['tasks']
            print(json.dumps({'tasks':[{ 'id':t['taskArn'].split('/')[-1], 'status':t['lastStatus'],'health':t.get('healthStatus'), 'containers':[{k:c.get(k) for k in ['name','lastStatus','healthStatus','exitCode','reason']} for c in t['containers']]} for t in ts]}),flush=True)
        for lb in s.get('loadBalancers',[]):
            health=aws('elbv2','describe-target-health',target_group_arn=lb['targetGroupArn'])
            print(json.dumps({'targets':health['TargetHealthDescriptions']}),flush=True)
    if time.monotonic()>=end:break
    time.sleep(30)
