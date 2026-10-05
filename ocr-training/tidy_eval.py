import json, re, sys
o=json.load(open(sys.argv[1])); r=json.load(open('test.json'))
L={'ar':'[ء-ي]','en':'[A-Za-z]'}
def tidy(t,l): return "\n".join(x for x in (" ".join(y.split()) for y in t.split("\n")) if len(re.findall(L[l],x))>=3)
json.dump([{'text':tidy(x[t['lang']]['raw'],t['lang'])} for x,t in zip(o,r)], open(sys.argv[2],'w'))
