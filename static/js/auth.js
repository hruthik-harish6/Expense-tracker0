const tabs = document.querySelectorAll('.tab');
const extra = document.getElementById('register-extra');
const title = document.getElementById('auth-title');
const submit = document.getElementById('auth-submit');
const error = document.getElementById('auth-error');
let mode = 'login';

tabs.forEach(tab => tab.addEventListener('click', () => {
  mode = tab.dataset.mode;
  tabs.forEach(t => t.classList.toggle('active', t === tab));
  const register = mode === 'register';
  extra.classList.toggle('hidden', !register);
  title.innerHTML = register ? '<h2>Build your workspace.</h2><p>Your account starts clean — your numbers only.</p>' : '<h2>Welcome back.</h2><p>Pick up exactly where you left off.</p>';
  submit.innerHTML = register ? 'Create my workspace <span>→</span>' : 'Enter workspace <span>→</span>';
  error.textContent = '';
}));

async function submitAuth(){
  error.textContent='';
  const name = document.getElementById('name')?.value?.trim() || '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if(mode==='register' && name.length<2){error.textContent='Enter your name.';return;}
  if(!email || !password){error.textContent='Enter your email and password.';return;}
  submit.disabled=true; submit.style.opacity='.6';
  try{
    const res = await fetch(mode==='register'?'/api/register':'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Something went wrong.');
    window.location.href='/app';
  }catch(e){error.textContent=e.message;}finally{submit.disabled=false;submit.style.opacity='1';}
}
submit.addEventListener('click', submitAuth);
document.addEventListener('keydown',e=>{if(e.key==='Enter')submitAuth();});
