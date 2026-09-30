"""Temporary facts-only HTTP recipe. Credentials stay in memory. No generation/confirmation."""
import importlib.util, pathlib, uuid, json, threading, hashlib, sys, time, os
if os.environ.get('CAPTCF_TEST_DEPS'): sys.path.insert(0,os.environ['CAPTCF_TEST_DEPS'])
from http.server import HTTPServer
root = pathlib.Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('controller', root / 'supabase/tests/source_usability_review_http.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.USERS.pop('D')
m.SOURCES = {'good': str(uuid.uuid4())}
FAMILY = str(uuid.uuid4())
MEASUREMENTS=[]
original_request=m.request
def measured_request(method,path,actor=None,payload=None):
    started=time.perf_counter()
    response=original_request(method,path,actor,payload)
    MEASUREMENTS.append({'path':path.split('?')[0],'status':response[0],'ms':round((time.perf_counter()-started)*1000,2)})
    return response
m.request=measured_request
EDGE = '/functions/v1/generate-differentiation-family'
original_manifest = m.manifest
def manifest():
    return dict(original_manifest(), family=FAMILY)
m.manifest = manifest
def read(table, ident, actor='A'):
    s,d=m.request('GET',f'/rest/v1/{table}?id=eq.{ident}&select=*',actor)
    assert s==200 and len(d)==1, f'read {table}: {s}'
    return d[0]
def snapshot():
    return read('pedagogical_sources',m.SOURCES['good']),read('differentiation_families',FAMILY)
def body(s,f,edits=None):
    return dict(action='revise_facts',sourceId=s['id'],familyId=f['id'],expected_hash=f['payload']['facts']['facts_hash'],expected_version=f['payload']['version'],expected_source_updated_at=s['updated_at'],edits=edits or [dict(fact_id='fact_01',subject='Charlotte',predicate='explique',object='Fait temporaire corrigé')])
def edge(actor,b):
    assert b['action'] in ('revise_facts','unknown_smoke_action')
    if 'sourceId' in b: assert b['sourceId']==m.SOURCES['good']
    return m.request('POST',EDGE,actor,b)
def check(name,response,status,code=None):
    return m.check(name,response,lambda s,d:s==status and (code is None or (d.get('error') or d.get('message') or d.get('code'))==code))
def rpc(actor,b):
    return m.request('POST','/rest/v1/rpc/revise_differentiation_facts_atomically',actor,dict(p_source_id=b['sourceId'],p_family_id=b['familyId'],p_expected_hash=b['expected_hash'],p_expected_version=b['expected_version'],p_expected_source_updated_at=b['expected_source_updated_at'],p_edits=b['edits']))
def tests():
    m.RESULTS.clear();MEASUREMENTS.clear()
    s,f=snapshot(); before=(s,f); b=body(s,f)
    check('anonymous Edge',edge(None,b),401)
    check('anonymous RPC',rpc(None,b),401)
    check('Edge unknown action',edge('A',{'action':'unknown_smoke_action'}),400)
    for actor in ('B','C'):
        check(actor+' Edge role/ownership denial',edge(actor,b),403,'FACTS_REVISION_FORBIDDEN')
        check(actor+' direct RPC denial',rpc(actor,b),403)
    check('Edge refuses client identity',edge('A',dict(b,user_id=m.USERS['B']['id'])),400,'FACTS_REQUEST_INVALID')
    check('Edge refuses forged provenance',edge('A',dict(b,edits=[dict(b['edits'][0],provenance={'quote':'forged'})])),400,'FACTS_REQUEST_INVALID')
    bad=dict(b,edits=[dict(fact_id='fact_02',subject='Charlotte',predicate='explique',object='temporary')])
    check('referenced fact removal denied',edge('A',bad),422,'FACT_REFERENCED_BY_ITEM')
    stale=dict(b,expected_hash='sha256:'+'0'*64)
    direct=check('RPC PT409 stale expected hash',rpc('A',stale),409,'FACTS_REVISION_CONFLICT')
    assert direct['code']=='PT409'
    direct_ms=MEASUREMENTS[-1]['ms']
    check('stale expected hash',edge('A',stale),409,'FACTS_REVISION_CONFLICT')
    edge_ms=MEASUREMENTS[-1]['ms']
    assert direct_ms<5000 and edge_ms<5000, 'Conflict exceeds 5s maximum; 2s target'
    payload=json.loads(json.dumps(f['payload']));payload['facts']['facts_hash']='forged'
    check('direct facts PATCH denied',m.request('PATCH',f'/rest/v1/differentiation_families?id=eq.{FAMILY}','A',{'payload':payload}),403,'FACTS_SERVER_WRITE_REQUIRED')
    assert snapshot()==before, 'Refusal changed rows'
    receipt=check('owner Edge revision succeeds',edge('A',b),200)
    s2,f2=snapshot();p=f2['payload']
    assert receipt['version']==2 and receipt['fact_count']==1 and receipt['status']=='draft'
    assert p['version']==2 and len(p['facts']['required'])==1
    assert p['facts']['required'][0]['provenance']==f['payload']['facts']['required'][0]['provenance']
    assert p['variants']==f['payload']['variants']
    assert p['facts_revision']['by']==m.USERS['A']['id'] and p['facts_revision']['requires_review']
    assert f2['review_status']=='draft' and f2['validation_status']=='pending'
    assert 'studio_facts_confirmation' not in s2['metadata']
    projection=[{k:fact[k] for k in ('fact_id','subject','predicate','object','semantic_qualifiers','required_for_task')} for fact in p['facts']['required']]
    expected='sha256:'+hashlib.sha256(json.dumps(projection,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    assert p['facts']['facts_hash']==expected==receipt['new_hash'] and expected!=b['expected_hash']
    check('stale owner save rejected',edge('A',b),409,'FACTS_REVISION_CONFLICT')
    assert snapshot()==(s2,f2)
    barrier=threading.Barrier(2)
    def save(i):
        barrier.wait(timeout=5)
        return edge('A',body(s2,f2,[dict(fact_id='fact_01',subject='Charlotte',predicate='explique',object=f'Concurrent temporary {i}')]))
    with m.concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(save,[1,2]))
    assert sorted(r[0] for r in responses)==[200,409], 'Concurrent results wrong'
    for i,r in enumerate(responses): check(f'concurrent owner save {i+1}',r,r[0],'FACTS_REVISION_CONFLICT' if r[0]==409 else None)
    s3,f3=snapshot()
    assert f3['payload']['version']==3 and f3['payload']['variants']==f['payload']['variants']
    assert 'studio_facts_confirmation' not in s3['metadata']
    return {'passed':True,'results':m.RESULTS,'hash_verified':True,'provenance_and_items_preserved':True,'no_confirmation':True,'no_model_calls':True,'concurrency':[r[0] for r in responses],'stale_rpc_ms':direct_ms,'stale_edge_ms':edge_ms,'measurements':MEASUREMENTS,'logical_requests':len(MEASUREMENTS)}
m.run_tests=tests
assert '--serve' in sys.argv, 'Explicit --serve required'
print('Facts-only controller ready: 127.0.0.1:18762; no credentials logged',flush=True)
HTTPServer(('127.0.0.1',18762),m.Handler).serve_forever()
