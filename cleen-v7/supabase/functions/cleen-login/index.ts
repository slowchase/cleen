// Cleen v7 password-only authentication gateway.
// Deploy as a PUBLIC Edge Function: the function verifies the supplied password via Supabase Auth.
// Do not use a service-role key for user sign-in or return raw user records.
const projectUrl = Deno.env.get('SUPABASE_URL') ?? '';
const publicKey = Deno.env.get('CLEEN_PUBLISHABLE_KEY') ?? '';
const allowedOrigin = (Deno.env.get('CLEEN_ALLOWED_ORIGIN') ?? '').replace(/\/$/, '');
const roles: Record<string, string | undefined> = {
  cleaner: Deno.env.get('CLEEN_CLEANER_EMAIL'),
  admin: Deno.env.get('CLEEN_ADMIN_EMAIL'),
};

function cors(origin: string | null): HeadersInit {
  // For local testing add an explicit localhost origin to the environment variable,
  // comma-separated. Never use '*' for a password endpoint.
  const allowed = allowedOrigin.split(',').map(x => x.trim()).filter(Boolean);
  const ok = origin !== null && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://invalid.example',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Access-Control-Max-Age': '3600',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}
function reply(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {status, headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8'}});
}
Deno.serve(async(req) => {
  const origin = req.headers.get('origin');
  const origins = allowedOrigin.split(',').map(x => x.trim()).filter(Boolean);
  if(req.method === 'OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(req.method !== 'POST')return reply({error:'Method not allowed.'},405,origin);
  if(!origin || !origins.includes(origin))return reply({error:'Origin not allowed.'},403,origin);
  if(!projectUrl || !publicKey || !roles.admin || !roles.cleaner)return reply({error:'Login is not configured.'},503,origin);
  let role: string, password: string;
  try {
    if(Number(req.headers.get('content-length')||'0') > 4096)return reply({error:'Request too large.'},413,origin);
    const body = await req.json(); role = body?.role; password = body?.password;
  } catch {return reply({error:'Invalid request.'},400,origin)}
  if(!Object.hasOwn(roles,role) || typeof password!=='string' || password.length<1 || password.length>256)
    return reply({error:'Invalid login request.'},400,origin);
  const email = roles[role];
  try {
    // Supabase Auth performs password verification and account-level throttling.
    const authRes=await fetch(`${projectUrl.replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{
      method:'POST',headers:{'apikey':publicKey,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000),
    });
    if(!authRes.ok)return reply({error:'Incorrect password or sign-in temporarily unavailable.'},401,origin);
    const result=await authRes.json();
    if(!result.access_token || !result.refresh_token)return reply({error:'Unable to start session.'},502,origin);
    // Confirm the account's actual role through the same RLS used by Cleen.
    const roleRes=await fetch(`${projectUrl.replace(/\/$/,'')}/rest/v1/members?select=role&user_id=eq.${encodeURIComponent(result.user.id)}`,{
      headers:{'apikey':publicKey,'Authorization':`Bearer ${result.access_token}`},
      signal:AbortSignal.timeout(10000),
    });
    const rows=roleRes.ok?await roleRes.json():[];
    if(!Array.isArray(rows)||rows[0]?.role !== role)
      return reply({error:'Account is not assigned to this Cleen area.'},403,origin);
    return reply({access_token:result.access_token,refresh_token:result.refresh_token},200,origin);
  }catch(e){console.error('Cleen login request failed',e instanceof Error?e.name:'error');return reply({error:'Sign-in unavailable. Please retry.'},503,origin)}
});
