const { Octokit } = require("@octokit/rest");
const Buffer = require("buffer").Buffer;

const OWNER = process.env.OWNER || "YOUR_GITHUB_USER";
const REPO = process.env.REPO || "shyam-invoice";

const octokit = new Octokit({
  auth: process.env.GH_PAT || process.env.GITHUB_TOKEN
});

function isoDateStr() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

async function getFileContent(path, branch="main"){
  try{
    const resp = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: branch });
    if(Array.isArray(resp.data)) return null;
    const content = Buffer.from(resp.data.content, resp.data.encoding).toString();
    return { sha: resp.data.sha, content };
  }catch(e){
    if(e.status === 404) return null;
    throw e;
  }
}

async function putFile(path, contentStr, message, branch="main"){
  const existing = await getFileContent(path, branch);
  const params = {
    owner: OWNER, repo: REPO, path, message,
    content: Buffer.from(contentStr).toString('base64'),
    branch
  };
  if(existing && existing.sha) params.sha = existing.sha;
  const res = await octokit.repos.createOrUpdateFileContents(params);
  return res.data;
}

async function listFilesInFolder(folder="invoices", branch="main"){
  try{
    const resp = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: folder, ref: branch });
    if(Array.isArray(resp.data)){
      return resp.data.map(x => x.name);
    }
    return [];
  }catch(e){
    if(e.status === 404) return [];
    throw e;
  }
}

function computeNextInvoiceName(existingNames){
  const today = new Date();
  const prefix = today.toISOString().slice(0,10).replace(/-/g,'');
  const pattern = new RegExp(`INV-${prefix}-(\\d{4})\\.json$`);
  let maxSeq = 0;
  for(const n of existingNames){
    const m = n.match(pattern);
    if(m){
      const seq = parseInt(m[1],10);
      if(seq>maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = (maxSeq + 1).toString().padStart(4,'0');
  return `INV-${prefix}-${nextSeq}.json`;
}

function jsonBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try{ resolve(JSON.parse(data||'{}')) } catch(e){ reject(e) }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if(req.method === "POST" && req.url === "/api/save-invoice"){
    try{
      const body = await jsonBody(req);
      const invoicesList = await listFilesInFolder("invoices");
      const nextName = computeNextInvoiceName(invoicesList);
      if(!body.invoiceNo || body.invoiceNo.trim()===""){
        body.invoiceNo = nextName.replace(/\.json$/,'');
      }
      if(!body.invoiceDate) body.invoiceDate = isoDateStr();
      const path = `invoices/${nextName}`;
      const message = `Add invoice ${nextName}`;
      await putFile(path, JSON.stringify(body, null, 2), message);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ success:true, filename: nextName, invoiceNo: body.invoiceNo }));
    }catch(e){
      console.error(e);
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ success:false, error: e.message }));
    }
    return;
  }

  if(req.method === "POST" && req.url === "/api/update-inventory"){
    try{
      const body = await jsonBody(req);
      const inv = body.inventory || [];
      const existing = await getFileContent("inventory.json");
      let merged = inv;
      if(existing && existing.content){
        try{
          const existingArr = JSON.parse(existing.content);
          const map = {};
          existingArr.forEach(i => map[ i.name + '||' + (i.batch||'') ] = i );
          merged.forEach(i => map[ i.name + '||' + (i.batch||'') ] = i );
          merged = Object.values(map);
        }catch(e){}
      }
      await putFile("inventory.json", JSON.stringify(merged, null, 2), `Update inventory (${new Date().toISOString()})`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ success:true }));
    }catch(e){
      console.error(e);
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ success:false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ success:false, message:"Invalid endpoint" }));
};
