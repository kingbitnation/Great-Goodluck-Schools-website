const http = require('http');

function req(method, path, data, token){
  return new Promise((resolve,reject)=>{
    const opts = { hostname: 'localhost', port: 4000, path, method, headers: { 'Content-Type': 'application/json' } }
    if(token) opts.headers.Authorization = `Bearer ${token}`
    const r = http.request(opts, (res)=>{
      let b=''
      res.on('data',c=>b+=c)
      res.on('end',()=>{ try{resolve({status:res.statusCode, body: JSON.parse(b)})}catch(e){resolve({status:res.statusCode, body:b})}})
    })
    r.on('error',reject)
    if(data) r.write(JSON.stringify(data))
    r.end()
  })
}

(async ()=>{
  try{
    console.log('Checking health...')
    console.log(await req('GET','/api/health'))
    console.log('Logging in...')
    const login = await req('POST','/api/auth/login', { email: 'admin@example.com', password: 'admin123' })
    console.log('Login:', login.status)
    const token = login.body?.accessToken
    if(!token){ console.error('no token'); process.exit(1)}
    console.log('Creating subject test-subj...')
    console.log('Listing schools...')
    const schools = await req('GET','/api/schools', null, token)
    console.log('Schools:', schools.status, schools.body.length)
    const schoolId = schools.body && schools.body[0] && schools.body[0].id
    console.log('Listing classes...')
    const classes = await req('GET','/api/classes', null, token)
    console.log('Classes:', classes.status, classes.body.length)
    const classId = classes.body && classes.body[0] && classes.body[0].id
    if (!schoolId || !classId) { console.log('No school/class available to create subject'); process.exit(0) }
    const create = await req('POST','/api/subjects',{ code: 'MATH101', name: 'Mathematics 101' , schoolId, classId }, token)
    console.log('Create response', create.status, create.body)
    console.log('Listing subjects...')
    const list = await req('GET','/api/subjects', null, token)
    console.log('Subjects:', list.status, Array.isArray(list.body)? list.body.length : list.body)
  }catch(e){ console.error('ERR', e.message); process.exit(1)}
  process.exit(0)
})()
