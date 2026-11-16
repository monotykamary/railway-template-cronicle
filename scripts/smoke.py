#!/usr/bin/env python3
"""Strict phase-aware product smoke. Test state is external to application volumes."""
import base64, hashlib, json, os, pathlib, re, secrets, time
import requests
BASE=os.environ['BASE_URL'].rstrip('/')
PHASE=os.environ['SMOKE_PHASE']
assert PHASE in ('boot','upgrade','redeploy'), PHASE
STATE=pathlib.Path(__file__).with_name('.state-'+hashlib.sha256(BASE.encode()).hexdigest()[:16]+'.json')
def seed(create):
    if PHASE=='boot':
        if STATE.exists(): return json.loads(STATE.read_text())
        data=create(); STATE.write_text(json.dumps(data)); return data
    assert STATE.exists(), 'missing boot seed; refusing to create during '+PHASE
    return json.loads(STATE.read_text())
def check(r, expected=200):
    assert r.status_code==expected, ('unexpected HTTP status', r.request.method, r.status_code); return r

s=requests.Session();session_id='';csrf=''
def api(path,body=None,success=True):
    data=dict(body or {})
    if session_id:data['session_id']=session_id
    r=check(s.post(BASE+path,json=data,headers={'X-CSRF-Token':csrf} if csrf else {},timeout=60));obj=r.json()
    if success:assert obj.get('code')==0, (path,obj)
    return obj
bad=api('/api/user/login',{'username':'railway-validation-invalid','password':'wrong'},False)
assert bad.get('code')=='login', 'invalid login accepted'
login=api('/api/user/login',{'username':os.environ['ADMIN_USERNAME'],'password':os.environ['ADMIN_PASSWORD']})
session_id=login.get('session_id','');csrf=login.get('csrf_token','');assert session_id
for _ in range(60):
    ready=api('/api/app/get_schedule',{'offset':0,'limit':1},False)
    if ready.get('code')==0:break
    assert ready.get('code')=='master';time.sleep(1)
else:raise AssertionError('master did not become ready')
# /status is deliberately ACL-restricted upstream. The public UI config exposes
# the release version without changing that ACL. Parse JSONP as data, never eval.
config_response=check(s.get(BASE+'/api/app/config',timeout=60))
config_text=config_response.text
prefix='app.receiveConfig(';suffix=');\n'
assert config_text.startswith(prefix) and config_text.endswith(suffix), 'public config envelope'
status=json.loads(config_text[len(prefix):-len(suffix)])
assert status.get('code')==0 and status.get('version') in (('0.9.137','0.9.146') if PHASE=='boot' else ('0.9.146',)), 'public config version'

def history(event_id):
    rows=api('/api/app/get_history',{'offset':0,'limit':100}).get('rows',[])
    return [r for r in rows if r.get('event')==event_id]
def create():
    title='Railway validation '+secrets.token_hex(8)
    event=api('/api/app/create_event',{'enabled':1,'title':title,'category':'general','target':'maingrp','plugin':'shellplug','params':{'script':'#!/bin/sh\nset -eu\nprintf "%s\\n" railway-cronicle-job-ok\n','annotate':0,'json':0},'timing':{},'max_children':1,'timeout':60,'catch_up':0,'timezone':'UTC','multiplex':0,'retries':0,'retry_delay':0,'detached':0,'notify_success':'','notify_fail':'','web_hook':'','cpu_limit':0,'cpu_sustain':0,'memory_limit':0,'memory_sustain':0,'log_max_size':0,'notes':'Railway release persistence validation'})
    eid=event['id'];deadline=time.monotonic()+260
    while time.monotonic()<deadline:
        rows=history(eid)
        assert all(r.get('code')==0 for r in rows), 'scheduled job failed'
        if len(rows)>=3:break
        time.sleep(2)
    else:raise AssertionError('fewer than three real scheduled executions')
    api('/api/app/update_event',{'id':eid,'enabled':0})
    return {'event':eid,'title':title,'job_ids':[r['id'] for r in rows]}
rec=seed(create)
event=api('/api/app/get_event',{'id':rec['event']})['event']
assert event['title']==rec['title'], 'boot-created event missing'
rows=history(rec['event']);ids={r['id'] for r in rows}
assert set(rec['job_ids']).issubset(ids), 'boot-created completed-job history missing'
assert all(r.get('code')==0 for r in rows), 'historical job failure'
print(json.dumps({'phase':PHASE,'version':status['version'],'scheduled_runs':len(rec['job_ids']),'event_and_history_persistence':'passed','negative_auth':'passed'}))
