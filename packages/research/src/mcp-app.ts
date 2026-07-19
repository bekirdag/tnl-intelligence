export const RESEARCH_MCP_APP_URI = 'ui://tnl/research-workspace' as const;

export const RESEARCH_MCP_APP_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TNL Research</title><style>
body{margin:0;font:14px system-ui,sans-serif;color:#1c2220;background:#f5f3ed}main{padding:16px;max-width:920px;margin:auto}
h1{font-size:20px;margin:0 0 12px}section{border-top:1px solid #c7cbc5;padding:12px 0}.meta{color:#53605a}.claim{margin:8px 0}
a{color:#8d2f24}code{font-size:12px}#empty{padding:24px 0;color:#53605a}
</style></head><body><main><h1>TNL Research</h1><div id="empty">Run a TNL research tool to inspect its cited result.</div><div id="result"></div></main>
<script>
const result=document.getElementById('result'),empty=document.getElementById('empty');
function render(data){if(!data||!data.directAnswer)return;empty.hidden=true;result.innerHTML='';
const answer=document.createElement('section');const p=document.createElement('p');p.textContent=data.directAnswer;answer.append(p);result.append(answer);
const claims=document.createElement('section');const h=document.createElement('h2');h.textContent='Claims';claims.append(h);
for(const claim of data.claims||[]){const row=document.createElement('div');row.className='claim';row.textContent=claim.statement+' ['+(claim.supportingEvidenceIds||[]).join(', ')+']';claims.append(row)}result.append(claims);
const meta=document.createElement('section');meta.className='meta';meta.textContent=(data.automatedAuthor?.name||'TNL Bot')+' · '+data.completionReason+' · As of '+data.asOf;result.append(meta)}
window.addEventListener('message',event=>{const payload=event.data?.params?.structuredContent?.data||event.data?.structuredContent?.data||event.data?.data;render(payload)});
</script></body></html>`;
